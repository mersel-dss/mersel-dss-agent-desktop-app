# Mersel İmzamatik

> **Mersel İmzamatik** — Türkiye'nin e-imza süreçleri için **Mersel** tarafından açık kaynak olarak geliştirilen masaüstü uygulaması. · [mersel.io](https://mersel.io)

Yereldeki **mali mühür / e-imza** kartına erişen [imza ajanını](https://github.com/mersel-dss/mersel-dss-agent-signer-java) ve [doğrulama servisini](https://github.com/mersel-dss/mersel-dss-verifier-api-java) otomatik indirip çalıştıran, e-belge **imzalama** ve **doğrulama** süreçlerini tek arayüzde toplayan açık kaynak masaüstü uygulaması.

İmzalama gücü Mersel'in, kullanım kolaylığı sizin: kart tak, sertifikanı seç, PIN'i yalnız imza anında gir — gerisini İmzamatik halleder.

> Tauri 2 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Clean Architecture

## Ne yapar?

- **Sıfır kurulum:** Platforma özel **JRE 1.8** uygulamayla birlikte paketlenir; kullanıcının makinesinde Java kurulu olmasına gerek yoktur (yine de varsa kullanılabilir).
- İki Java servisini (agent + verifier) **sidecar** olarak yönetir: GitHub Releases'ten **otomatik indirir/günceller**, `java -jar` ile **boş bir porttan başlatır**, sağlık kontrolü yapar, durdurur.
- **Otomatik güncelleme:** Açılışta jar'ların en güncel sürümünü hazırlar; uygulamanın kendisi de Tauri updater ile platforma özel installer'lar üzerinden güncellenir.
- **İmzalama:** Akıllı kart/sertifika listeler, PDF'i **PAdES-B**, XML'i **XAdES-BES / Counter-Signature** ile imzalar. PIN yalnızca imza anında istenir, hiçbir yerde saklanmaz.
- **Doğrulama:** İmzalı dokümanları (XAdES/PAdES/CAdES) ve **RFC 3161** zaman damgalarını doğrular.

### Otomatik kurulum/başlatma akışı

Açılışta arka planda (uygulamayı bloke etmeden) şunlar olur:

1. **Jar güncelleme** — her servis için GitHub'daki en güncel release sorgulanır; yerel sürüm (`installed.json`) eski ya da jar eksikse indirilir, eski jar'lar temizlenir.
2. **Java tespiti** — önce paketlenmiş JRE (`<resource_dir>/jre`), sonra `JAVA_HOME`, sonra `PATH`.
3. **Boş porttan başlatma** — her servis tercih edilen porttan (agent `15212`, verifier `8086`) başlayıp **ilk boş porta** yerleşir. Port doluysa komşu portlar, o da olmazsa işletim sisteminin atadığı geçici port denenir. Servis dışarıdan zaten çalışıyorsa kopya başlatılmaz.

Ayrıca uygulama **açık olduğu sürece arka planda periyodik (3 saatte bir)** GitHub
kontrol edilir: yeni bir jar sürümü yayınlandıysa otomatik indirilir ve servis bu
uygulama tarafından çalışıyorsa yeni sürümle yeniden başlatılarak güncelleme uygulanır.
İndirme ilerlemesi ve sonuç (`download-progress` / `service-updated` event'leri) UI'a
yansıtılır.

## Mimari (Clean Architecture)

Java servisleriyle tüm iletişim **Rust (reqwest) üzerinden Tauri komutları** ile yapılır; webview hiçbir zaman doğrudan HTTP atmaz. Bu, CORS/CSP ve multipart dosya yükleme sorunlarını ortadan kaldırır.

```
src/                         Frontend (katmanlı)
  domain/                    Saf tipler + port arayüzleri (bağımlılıksız)
    services/ signing/ verification/ platform/
  application/               Use-case'ler (react-query hook'ları)
  infrastructure/            Adaptörler: Tauri IPC istemcileri, event'ler
  presentation/              React: layout, sayfalar, features, shadcn/ui
  shared/                    Yardımcılar, config, lib
  app/                       Composition root (DI), provider'lar, router

src-tauri/src/               Backend (Rust)
  models.rs error.rs config.rs java.rs state.rs net.rs
  process/                   Jar çözümleme + süreç yaşam döngüsü
  download/                  GitHub release keşfi + indirme + sürüm üst verisi
  http/                      agent & verifier REST istemcileri
  commands/                  Frontend'e açılan Tauri komutları + otomatik kurulum

src-tauri/resources/jre21/   Paketlenmiş JRE 21 — tüm servisler (build'de `pnpm fetch-jre` ile doldurulur)
scripts/fetch-jre.mjs        Platforma özel Temurin JRE 21 indirme/normalizasyon
```

Bağımlılık yönü her zaman içeri doğrudur: `presentation → application → domain`, `infrastructure → domain`. Her dosya ~300-500 satır sınırında tutulur.

## Gereksinimler

- Node 18+ ve **pnpm**
- **Rust** (stable) + platform Tauri ön koşulları
- Geliştirme sırasında sistemde **Java 21+** önerilir (paket build'inde JRE 21 gömülür; geliştirmede sistem Java'sı kullanılır)

## Geliştirme

```bash
pnpm install
pnpm tauri dev      # uygulamayı geliştirme modunda aç (sistem Java'sını kullanır)
pnpm build          # tsc + vite (frontend tip kontrolü/derleme)
```

> Geliştirmede paketlenmiş JRE'yi denemek için `MERSEL_JRE21_HOME` ortam değişkenini
> bir JRE kök dizinine (içinde `bin/` olan) ayarlayabilirsiniz.

## Dağıtılabilir paket üretimi (installer)

Her platformda **kendi** üzerinde build alınır (cross-compile değil). Önce o platforma
ait JRE 21'i indirip gömün, sonra paketleyin:

```bash
pnpm fetch-jre      # host platform/mimari için Temurin JRE 21 indirir → src-tauri/resources/jre21
pnpm tauri build    # platforma özel installer üretir
```

Üretilen installer formatları:

| Platform        | Format                    |
|-----------------|---------------------------|
| Windows         | NSIS (`.exe`) — kullanıcı kurulumu |
| macOS           | `.app` + `.dmg`           |
| Linux (Ubuntu)  | `.deb` + `.AppImage`      |

> JRE'siz mimariler: Temurin **JRE 8 macOS aarch64** ve **Windows aarch64** yoktur;
> `fetch-jre` bu durumda otomatik **x64**'e düşer (Apple Silicon'da Rosetta 2,
> Windows'ta x64 emülasyonu ile çalışır).

### Otomatik güncelleme (updater) imzalama

Updater, imzalı paketler ister. İmza anahtarı bir kez üretilir (gizli tutulur):

```bash
pnpm tauri signer generate -w src-tauri/.tauri/mersel-updater.key
```

`.pub` içeriği `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` alanına yazılır
(bu repoda hazırdır). Build sırasında private key ortam değişkenleriyle verilir:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat src-tauri/.tauri/mersel-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""   # anahtar parolası (varsa)
pnpm tauri build
```

`bundle.createUpdaterArtifacts` açık olduğundan build, installer'ların yanında imzalı
updater artefaktları ve `.sig` dosyaları üretir. Bunlar bir `latest.json` ile birlikte
GitHub Releases'e yüklenir; uygulama `plugins.updater.endpoints`'teki adresten kontrol eder.

> **Önemli:** Private key (`*.key`) ve `src-tauri/.tauri/` dizini `.gitignore`'dadır;
> asla repoya commit edilmemelidir. Kaybedilirse updater bir daha imzalanamaz.

## Servis portları

Aşağıdaki portlar **tercih edilen** başlangıç portlarıdır; doluysa otomatik olarak
ilk boş porta yerleşilir.

| Servis      | Tercih edilen port | Repo |
|-------------|--------------------|------|
| İmza Ajanı  | `15212`            | `mersel-dss-agent-signer-java` |
| Doğrulama   | `8086`             | `mersel-dss-verifier-api-java` |

## Lisans

Açık kaynak · Apache-2.0
