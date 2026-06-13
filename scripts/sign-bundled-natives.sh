#!/usr/bin/env bash
# macOS notarization için: GÖMÜLÜ servislerin Mach-O native'lerini Developer ID +
# secure timestamp ile imzalar. İki kaynak:
#   1) Java servis jar'larının İÇİNDEKİ imzasız (ad-hoc/linker-signed) .jnilib/.dylib
#      kütüphaneleri (örn. agent → libpkcs11wrapper.jnilib) — yeniden imzalanıp
#      nested jar STORED biçimde geri gömülür.
#   2) html-to-pdf (.NET self-contained + Playwright) LOOSE Mach-O ikilileri
#      (apphost `Web`, `*.dylib`, `node` ...). Bunlar hardened runtime + .NET JIT
#      entitlements ile imzalanır (yoksa notarization geçse bile uygulama JIT
#      yüzünden çalışmaz).
#
# Neden: Apple notary, .app içine giren jar'ların içini de açıp tarar ve her
# Mach-O binary'nin Developer ID imzalı + timestamp'li olmasını ister. `agent`
# jar'ı `BOOT-INF/lib/ipkcs11wrapper-*.jar` içinde ad-hoc imzalı bir
# `libpkcs11wrapper.jnilib` taşır → imzalanmazsa notarization patlar (v0.1.11
# macOS build'i bu yüzden çöktü).
#
# Spring Boot şartı: `BOOT-INF/lib/*.jar` girdileri executable jar içinde STORED
# (sıkıştırmasız) tutulmalıdır; nested jar loader bunu mmap eder. Bu yüzden
# yeniden imzalanan nested jar üst jar'a tekrar STORED olarak gömülür.
#
# Yalnız macOS'ta anlamlıdır. CI'da `APPLE_SIGNING_IDENTITY` (+ keychain için
# `APPLE_CERTIFICATE`/`APPLE_CERTIFICATE_PASSWORD`) ile çağrılır. Yerel testte
# `APPLE_SIGNING_IDENTITY=-` verilirse ad-hoc imza kullanılır (timestamp'siz).
#
# Kullanım:
#   APPLE_SIGNING_IDENTITY="Developer ID Application: ... (TEAMID)" \
#   APPLE_CERTIFICATE=<base64 p12> APPLE_CERTIFICATE_PASSWORD=<pwd> \
#   bash scripts/sign-bundled-natives.sh

set -uo pipefail

SERVICES_DIR="${SERVICES_DIR:-src-tauri/resources/services}"
IDENTITY="${APPLE_SIGNING_IDENTITY:-}"

die() { echo "✗ $*" >&2; exit 1; }

if [ "$(uname -s)" != "Darwin" ]; then
  echo "↪ macOS değil; native imzalama atlanıyor."
  exit 0
fi

if [ -z "$IDENTITY" ]; then
  # İmza yapılandırılmamış (örn. fork PR / secret yok): sessizce geç. Bu durumda
  # zaten notarization da çalışmaz; native imzasız kalır.
  echo "↪ APPLE_SIGNING_IDENTITY tanımlı değil; native imzalama atlanıyor."
  exit 0
fi

# codesign çağrısı: gerçek Developer ID için timestamp + hardened runtime; yerel
# ad-hoc test (IDENTITY="-") için timestamp YOK (ad-hoc timestamp alamaz). Kimlik
# boşluk içerdiğinden ("Developer ID Application: ... (TEAM)") tırnaklı geçilir.
sign_one() {
  if [ "$IDENTITY" = "-" ]; then
    codesign --force -s - "$1" || die "codesign başarısız: $1"
  else
    codesign --force --timestamp --options runtime -s "$IDENTITY" "$1" \
      || die "codesign başarısız: $1"
  fi
}

# .NET (html-to-pdf) Mach-O ikilileri için entitlements. .NET, JIT (R2R + dinamik
# kod üretimi) kullandığından hardened runtime altında bu izinler olmadan çöker;
# disable-library-validation ise apphost'un gömülü coreclr/Playwright dylib'lerini
# yüklemesini garanti eder.
ENT="$(mktemp -t dotnet-ent).plist"
cat > "$ENT" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict></plist>
PLIST

# html-to-pdf Mach-O imzası: hardened runtime + .NET entitlements. (Entitlements
# dylib'lerde sistemce yok sayılır ama zarar vermez; tek geçişte hepsine uygulanır.)
sign_runtime_ent() {
  if [ "$IDENTITY" = "-" ]; then
    codesign --force --options runtime --entitlements "$ENT" -s - "$1" \
      || die "codesign başarısız: $1"
  else
    codesign --force --timestamp --options runtime --entitlements "$ENT" -s "$IDENTITY" "$1" \
      || die "codesign başarısız: $1"
  fi
}

# Gerçek imza kimliği bir keychain'de olmalı. tauri-action kendi keychain'ini
# AYRI kurar; bizimki yalnız bu adım içindir. Ad-hoc modda gerek yok.
if [ "$IDENTITY" != "-" ] && [ -n "${APPLE_CERTIFICATE:-}" ]; then
  KC_DIR="${RUNNER_TEMP:-/tmp}"
  KEYCHAIN="$KC_DIR/nested-codesign.keychain-db"
  KC_PASS="$(openssl rand -base64 24)"
  security create-keychain -p "$KC_PASS" "$KEYCHAIN" || die "keychain create"
  security set-keychain-settings -lut 21600 "$KEYCHAIN"
  security unlock-keychain -p "$KC_PASS" "$KEYCHAIN" || die "keychain unlock"
  echo "$APPLE_CERTIFICATE" | base64 --decode > "$KC_DIR/nested-cert.p12"
  security import "$KC_DIR/nested-cert.p12" -P "${APPLE_CERTIFICATE_PASSWORD:-}" \
    -A -t cert -f pkcs12 -k "$KEYCHAIN" || die "cert import"
  rm -f "$KC_DIR/nested-cert.p12"
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KC_PASS" "$KEYCHAIN" >/dev/null 2>&1
  # Aramaya bizim keychain'i de ekle (mevcutları koruyarak).
  EXISTING="$(security list-keychains -d user | sed 's/[" ]//g' | tr '\n' ' ')"
  security list-keychains -d user -s "$KEYCHAIN" $EXISTING
fi

found_any=0

# agent/verifier/xslt üst jar'larını gez.
for jar in "$SERVICES_DIR"/*/*.jar; do
  [ -e "$jar" ] || continue
  jar_abs="$(cd "$(dirname "$jar")" && pwd)/$(basename "$jar")"

  # Bu jar'ın native taşıyabilecek nested lib jar'ları.
  inners="$(unzip -Z1 "$jar_abs" 2>/dev/null | grep -E '^BOOT-INF/lib/.*\.jar$')"
  [ -z "$inners" ] && continue

  printf '%s\n' "$inners" | while IFS= read -r inner; do
    [ -z "$inner" ] && continue
    tmp="$(mktemp -d)"
    unzip -p "$jar_abs" "$inner" > "$tmp/inner.jar" 2>/dev/null

    # Bu nested jar mac native taşıyor mu? (grep -q + pipefail SIGPIPE tuzağından
    # kaçınmak için çıktıyı yakalayıp test ediyoruz.)
    natives_in_jar="$(unzip -Z1 "$tmp/inner.jar" 2>/dev/null | grep -iE '\.(jnilib|dylib)$')"
    if [ -z "$natives_in_jar" ]; then
      rm -rf "$tmp"; continue
    fi

    iw="$tmp/x"; mkdir -p "$iw"
    unzip -q "$tmp/inner.jar" -d "$iw" || die "nested jar açılamadı: $inner"

    signed=0
    while IFS= read -r lib; do
      [ -z "$lib" ] && continue
      ftype="$(file "$lib")"
      case "$ftype" in
        *Mach-O*)
          echo "  → imzalanıyor: $(basename "$jar") :: $inner :: ${lib#"$iw"/}"
          sign_one "$lib"
          signed=1
          ;;
      esac
    done <<EOF
$(find "$iw" -type f \( -name '*.jnilib' -o -name '*.dylib' \))
EOF

    if [ "$signed" -eq 1 ]; then
      rm -f "$tmp/inner.jar"
      ( cd "$iw" && zip -q -r -X "$tmp/inner.jar" . ) || die "nested jar paketlenemedi: $inner"
      # Üst jar'da nested jar'ı STORED olarak değiştir.
      stage="$tmp/stage"; mkdir -p "$stage/$(dirname "$inner")"
      cp "$tmp/inner.jar" "$stage/$inner"
      zip -d "$jar_abs" "$inner" >/dev/null || die "eski nested jar silinemedi: $inner"
      ( cd "$stage" && zip -0 -X -q "$jar_abs" "$inner" ) || die "nested jar STORED gömülemedi: $inner"
      echo "✓ $(basename "$jar") :: $inner yeniden imzalandı + STORED gömüldü"
    fi
    rm -rf "$tmp"
  done
  # while pipe ALT-KABUKTA koşar; içindeki `die` yalnız alt-kabuğu sonlandırır.
  # Hatayı (codesign/zip başarısızlığı) parent'a taşıyıp build'i düşürmek için
  # pipeline çıkış kodunu kontrol ediyoruz (pipefail açık).
  rc=$?
  [ "$rc" -ne 0 ] && die "gömülü native imzalama başarısız (jar: $(basename "$jar"))"

  found_any=1
done

# html-to-pdf (.NET self-contained + Playwright) — Tauri .app içine giren LOOSE
# Mach-O ikilileri. Notary HEPSİNİN Developer ID + hardened runtime imzalı
# olmasını ister; apphost ayrıca .NET JIT entitlements'a ihtiyaç duyar.
H2P_DIR="$SERVICES_DIR/html-to-pdf"
if [ -d "$H2P_DIR" ]; then
  echo "→ html-to-pdf Mach-O ikilileri imzalanıyor ($H2P_DIR)"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$(file "$f" 2>/dev/null)" in
      *Mach-O*)
        echo "  → imzalanıyor: ${f#"$H2P_DIR"/}"
        sign_runtime_ent "$f"
        found_any=1
        ;;
    esac
  done <<EOF
$(find "$H2P_DIR" -type f)
EOF
fi

if [ "$found_any" -eq 0 ]; then
  echo "↪ İmzalanacak gömülü native bulunamadı ($SERVICES_DIR)."
fi
echo "✓ Gömülü native imzalama tamamlandı."
