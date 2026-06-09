#!/usr/bin/env bash
#
# release.sh — tek komutla sürüm bump + commit + tag + push (CI release tetikler).
#
# NEDEN: Sürüm üç ayrı dosyada tutuluyor ve hepsi 0.1.0'da takılıydı. CI build'i
# sürümü `src-tauri/tauri.conf.json`'dan okuduğundan her release 0.1.0 olarak
# çıkıyordu; updater de `latest.json`'da hep "0.1.0" görüp "zaten güncel" diyerek
# güncelleme bulamıyordu. Bu betik sürümü TEK komutla şu dosyalarda senkron tutar:
#   - package.json
#   - src-tauri/tauri.conf.json   (uygulamanın gösterdiği sürüm + latest.json)
#   - src-tauri/Cargo.toml        (+ Cargo.lock)
#
# CHANGELOG: `CHANGELOG.md` içindeki `## [Unreleased]` bölümünün içeriği yeni
# `## [x.y.z] - TARİH` başlığı altına TAŞINIR, Unreleased boşaltılır ve alttaki
# karşılaştırma (compare) linkleri güncellenir. Yani "bu sürümde ne yapıldı?"nın
# tek kaynağı CHANGELOG'un Unreleased bölümüdür — geliştirirken oraya yazarsın,
# release anında otomatik olarak ilgili sürümün altına geçer. (SKIP_CHANGELOG=1
# ile atlanabilir; Unreleased boşsa betik uyarıp CHANGELOG'u değiştirmez.)
#
# KULLANIM:
#   ./release.sh 0.1.6     # belirli sürüm
#   ./release.sh patch     # 0.1.5 -> 0.1.6
#   ./release.sh minor     # 0.1.5 -> 0.2.0
#   ./release.sh major     # 0.1.5 -> 1.0.0
#
# ORTAM DEĞİŞKENLERİ:
#   DRY_RUN=1     dosyaları güncelle + doğrula ama git işlemi yapma (deneme için)
#   NO_PUSH=1     commit + tag oluştur ama push etme
#   ALLOW_DIRTY=1 çalışma ağacı kirliyken de izin ver (önerilmez)
#   REMOTE=origin push hedefi (varsayılan: origin)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

die()  { echo "✗ $*" >&2; exit 1; }
info() { echo "▸ $*"; }

[ $# -eq 1 ] || die "Kullanım: ./release.sh <x.y.z|patch|minor|major>"
command -v node >/dev/null || die "node gerekli (JSON dosyalarını güvenle güncellemek için)."
command -v git  >/dev/null || die "git gerekli."

CARGO_PKG="mersel-dss-agent-desktop"

# ── Mevcut sürüm (tek kaynak: tauri.conf.json) ──
CURRENT="$(node -p "require('./src-tauri/tauri.conf.json').version")"
[[ "$CURRENT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Mevcut sürüm okunamadı: '$CURRENT'"

# ── Hedef sürümü hesapla ──
ARG="$1"
if [[ "$ARG" =~ ^(patch|minor|major)$ ]]; then
  IFS='.' read -r MA MI PA <<< "$CURRENT"
  case "$ARG" in
    patch) PA=$((PA + 1)) ;;
    minor) MI=$((MI + 1)); PA=0 ;;
    major) MA=$((MA + 1)); MI=0; PA=0 ;;
  esac
  NEW="$MA.$MI.$PA"
else
  NEW="$ARG"
fi
[[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Geçersiz sürüm: '$NEW' (x.y.z bekleniyor)"
[ "$NEW" != "$CURRENT" ] || die "Yeni sürüm mevcutla aynı: $NEW"

TAG="v$NEW"
info "Mevcut: $CURRENT  →  Yeni: $NEW  (tag: $TAG)"

# Önceki sürümün tag'i var mı? (CHANGELOG compare linki için.)
PREV_TAG_EXISTS=""
git rev-parse -q --verify "refs/tags/v$CURRENT" >/dev/null 2>&1 && PREV_TAG_EXISTS=1

# ── Ön kontroller (DRY_RUN'da atlanır) ──
if [ -z "${DRY_RUN:-}" ]; then
  git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "Tag zaten mevcut: $TAG"
  if [ -z "${ALLOW_DIRTY:-}" ] && [ -n "$(git status --porcelain)" ]; then
    die "Çalışma ağacı kirli. Önce commit'le ya da ALLOW_DIRTY=1 ile çalıştır."
  fi
fi

# ── Dosyaları güncelle ──
# JSON dosyalarında yalnız "version": "<eski>" alanını değiştir (tüm dosyayı
# yeniden serialize edip biçimi bozmadan; üst-düzey "version" tek kez geçer ve
# bağımlılık sürümleri "0.1.0" gibi görünmediğinden eşleşme güvenlidir).
update_json() { # $1=dosya
  perl -0pi -e 's/("version"\s*:\s*")'"$CURRENT"'(")/${1}'"$NEW"'${2}/' "$1"
}

update_json package.json
update_json src-tauri/tauri.conf.json

# CHANGELOG: [Unreleased] içeriğini yeni sürüm başlığı altına taşı + linkleri
# güncelle. Best-effort: dosya yoksa / Unreleased boşsa uyarıp atlar.
update_changelog() {
  [ -n "${SKIP_CHANGELOG:-}" ] && { info "SKIP_CHANGELOG=1 → CHANGELOG atlandı."; return 0; }
  [ -f CHANGELOG.md ] || { info "CHANGELOG.md yok — atlanıyor."; return 0; }
  node -e '
    const fs = require("fs");
    const [version, date, prev, prevTag] = process.argv.slice(1);
    const repo = "https://github.com/mersel-dss/mersel-dss-agent-desktop-app";
    const file = "CHANGELOG.md";
    let text = fs.readFileSync(file, "utf8");

    const header = "## [Unreleased]";
    const idx = text.indexOf(header);
    if (idx === -1) { console.error("  UYARI: [Unreleased] başlığı yok — CHANGELOG atlandı."); process.exit(0); }

    const headerEnd = idx + header.length;
    const after = text.slice(headerEnd);
    let boundary = text.length;
    const mSec = after.match(/\n## \[/);            // sonraki sürüm bölümü
    if (mSec) boundary = Math.min(boundary, headerEnd + mSec.index);
    const mLink = after.match(/\n\[[^\]]+\]:\s/);   // alttaki link tanımları
    if (mLink) boundary = Math.min(boundary, headerEnd + mLink.index);

    const body = text.slice(headerEnd, boundary).trim();
    if (!body) { console.error("  UYARI: [Unreleased] boş — CHANGELOG değiştirilmedi."); process.exit(0); }

    const section = header + "\n\n## [" + version + "] - " + date + "\n\n" + body + "\n";
    text = text.slice(0, idx) + section + text.slice(boundary);

    const cmp = prevTag === "1"
      ? repo + "/compare/v" + prev + "...v" + version
      : repo + "/releases/tag/v" + version;
    text = text.replace(/\[Unreleased\]:[^\n]*/,
      "[Unreleased]: " + repo + "/compare/v" + version + "...HEAD\n[" + version + "]: " + cmp);

    fs.writeFileSync(file, text);
    console.error("  CHANGELOG: [Unreleased] içeriği [" + version + "] altına taşındı.");
  ' "$NEW" "$(date +%F)" "$CURRENT" "${PREV_TAG_EXISTS:-}"
}
update_changelog

# Cargo.toml: yalnız [package] bloğundaki version satırı (bağımlılıkların
# satır-içi `version = "2"` alanlarına dokunma).
perl -0pi -e \
  's/(\[package\][^\[]*?\nversion\s*=\s*")[0-9]+\.[0-9]+\.[0-9]+(")/${1}'"$NEW"'${2}/s' \
  src-tauri/Cargo.toml

# Cargo.lock senkron (derleme yapmadan; başarısız olursa CI build'i nasılsa
# güncelleyecektir, bu yüzden best-effort).
( cd src-tauri && cargo update -p "$CARGO_PKG" --precise "$NEW" >/dev/null 2>&1 \
  || cargo update -p "$CARGO_PKG" >/dev/null 2>&1 || true )

# ── Doğrula ──
for f in package.json src-tauri/tauri.conf.json; do
  got="$(node -p "require(require('path').resolve('$f')).version")"
  [ "$got" = "$NEW" ] || die "$f güncellenemedi (okunan: $got)"
done
grep -Eq "^version = \"$NEW\"" src-tauri/Cargo.toml || die "src-tauri/Cargo.toml güncellenemedi"
info "Sürüm dosyaları güncellendi."

# ── git ──
FILES=(package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml)
[ -f src-tauri/Cargo.lock ] && FILES+=(src-tauri/Cargo.lock)
[ -f CHANGELOG.md ] && [ -z "${SKIP_CHANGELOG:-}" ] && FILES+=(CHANGELOG.md)

if [ -n "${DRY_RUN:-}" ]; then
  info "DRY_RUN=1 → git işlemi yok. Değişiklikler:"
  git --no-pager diff -- "${FILES[@]}" || true
  info "Geri almak için: git checkout -- ${FILES[*]}"
  exit 0
fi

git commit -m "chore(release): $TAG" -- "${FILES[@]}"
git tag -a "$TAG" -m "$TAG"
info "Commit + tag oluşturuldu: $TAG"

if [ -n "${NO_PUSH:-}" ]; then
  REMOTE="${REMOTE:-origin}"
  info "NO_PUSH=1 → push atlandı. Elle: git push $REMOTE HEAD && git push $REMOTE $TAG"
  exit 0
fi

REMOTE="${REMOTE:-origin}"
info "Push ediliyor → $REMOTE (branch + $TAG)…"
git push "$REMOTE" HEAD
git push "$REMOTE" "$TAG"
info "Bitti. CI release '$TAG' ile tetiklendi: https://github.com/mersel-dss/mersel-dss-agent-desktop-app/actions"
