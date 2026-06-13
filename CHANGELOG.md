# Değişiklik Günlüğü

Bu projedeki tüm önemli değişiklikler bu dosyada belgelenir.

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) temellidir ve
proje [Semantic Versioning](https://semver.org/lang/tr/) izler.

## [Unreleased]

## [0.1.23] - 2026-06-14

### Değiştirildi

- **Servis indirmeleri de R2'den (R2 geçişi tamamlandı).** Saatlik manifest
  workflow'u servis jar'larını (agent/verifier/xslt) ve html-to-pdf platform
  paketlerini R2'ye aynalayıp manifest URL'lerini R2'ye yazıyor; yalnız
  uygulamanın gerçekten indirdiği asset'ler aynalanır (servis repolarının
  bağımsız kurulumları/SBOM/checksum'ları hariç). Böylece installer, oto-güncelleme
  ve çalışma anı servis indirmelerinin tamamı Cloudflare R2'den (hızlı + ücretsiz
  egress) iner; her yolda GitHub yedek olarak kalır.

## [0.1.22] - 2026-06-13

### Değiştirildi

- **Otomatik güncelleme artık R2'den iniyor.** Updater'ın birincil ucu Cloudflare
  R2 (`latest.json`) olarak ayarlandı; GitHub Release yedek uç olarak korunuyor.
  Böylece güncelleme indirmesi Cloudflare edge'inden (TR'ye yakın) hızlı + ücretsiz
  egress ile gelir, R2 erişilemezse GitHub'a düşer.

## [0.1.21] - 2026-06-13

### Eklendi

- **Cloudflare R2 aynası (daha hızlı indirme).** GitHub Release yayınlandıktan
  sonra çalışan yeni bir CI işi (`publish-r2`), tüm installer + updater
  artefaktlarını R2'ye aynalar ve `latest.json`'daki indirme URL'lerini R2 tabanına
  yeniden yazar. R2 egress ücretsizdir ve Cloudflare edge'inden (TR'ye yakın PoP)
  servis edilir; GitHub Release yine durur ve updater'da yedek uç olarak kalır.
  Repo secret'ları (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`,
  `R2_BUCKET`, `R2_PUBLIC_BASE`) tanımlı değilse iş sessizce no-op olur.

## [0.1.20] - 2026-06-13

### Düzeltildi

- **Windows güncelleme "Error opening file for writing: …\\jre21\\bin\\extnet.dll"
  hatası (regresyon) giderildi.** OS-seviyesi Windows Servislerine geçişle birlikte
  servisler artık uygulamanın spawn ettiği child process'ler değil, bağımsız Windows
  Service'leri; bu yüzden uygulamanın ön-güncelleme durdurması bunları kapatmıyor ve
  çalışan `java.exe` gömülü JRE DLL'lerini kilitli tutuyordu. NSIS installer'a bir
  **PREINSTALL** hook'u eklendi: dosyalar yazılmadan önce `net stop` (senkron) ile
  tüm Mersel servisleri tamamen durdurulur, kilitler bırakılır. Hook installer'a
  derlendiğinden bu hook'a sahip olmayan eski sürümden güncellemeyi de düzeltir.

### Değiştirildi

- **Gömülü Java runtime jlink ile ~2.6 kat küçüldü (~151MB → ~57MB).** Tam Temurin
  JRE 21 yerine, servislerin (agent/verifier/xslt) gerçekten kullandığı modüllerden
  `jlink` ile özel bir runtime üretiliyor. Modül seti `jdeps` ile çıkarıldı; reflection
  ile yüklenen ve jdeps'in göremediği modüller elle eklendi: `jdk.crypto.cryptoki`
  (PKCS#11 / mali mühür), `jdk.crypto.ec`, `jdk.localedata` + `jdk.charsets` (Türkçe
  locale ve `windows-1254`/`ISO-8859-9`), `jdk.security.auth`, `jdk.zipfs`,
  `java.xml.crypto` (XAdES). Yeni `scripts/build-jre.mjs` (`pnpm build-jre`) JAVA_HOME/
  PATH'teki JDK 21 ile jlink çalıştırır; yoksa indirir. CI her platformda native runtime
  üretir. İmza+doğrulama+XSLT+Türkçe biçimlendirme minimal runtime'da test edilerek
  doğrulandı.
- **Genel Bakış servisleri tablo yerine kart ızgarasında.** Her servis; ikon, durum,
  port/sürüm çipleri, üstte ince durum şeridi ve hover gölgesiyle modern bir kartta
  gösterilir. Her karta "**ne için kullanılır**" odaklı sade bir açıklama eklendi.
- **"Java Çalışma Zamanları" bölümü kaldırıldı.** Artık tek bir JRE (Java 21)
  paketlendiğinden iki ayrı runtime göstermek yanıltıcıydı.

## [0.1.10] - 2026-06-09

### Eklendi

- **Profesyonel uygulama güncelleme bildirimi.** Yeni bir sürüm çıktığında üst
  menüdeki küçük buton yerine, sağ-altta beliren şık bir kart gösterilir: sürüm
  bilgisi, **Güncelle** / **Daha sonra** aksiyonları ve indirme sırasında **canlı
  ilerleme çubuğu** (yüzde + indirilen/toplam boyut). Hata olursa neden + **Tekrar
  dene** sunulur. Böylece kullanıcı güncellemenin ne durumda olduğunu net görür.

### Düzeltildi

- **Windows güncelleme "Error opening file for writing: …\\jre\\bin\\java.dll"
  hatası giderildi.** Güncelleme indirilmeden önce tüm Java servisleri durdurulup
  process kilitlerinin (özellikle `java.dll`) serbest kalması beklenir; aksi hâlde
  çalışan süreçler dosyayı kilitli tutuyor ve NSIS kurulumu üzerine yazamıyordu.

## [0.1.9] - 2026-06-09

### Değiştirildi

- **Servis sürümleri artık merkezi bir CDN manifestinden çözülüyor.** İstemci
  son sürüm bilgisini `api.github.com` yerine GitHub Pages'te yayınlanan statik
  bir `manifest.json`'dan okur (sunucu tarafında token'lı zamanlanmış bir Action
  saatte bir tazeler). Böylece kimliksiz GitHub API'nin **saatte 60 istek**
  limiti devre dışı kalır; aynı genel IP (kurumsal NAT) arkasındaki çok sayıda
  kullanıcı artık 403 almaz. Manifest erişilemezse istemci güvenle eski API
  yoluna düşer.
- **Java servisleri yalnız `127.0.0.1` (loopback) dinliyor.** Spring Boot
  varsayılan `0.0.0.0` bağlanması Windows Defender Firewall'un her servis için
  izin penceresi açmasına yol açıyordu; servise yalnız bu makineden erişildiği
  için loopback'e sabitlendi — firewall penceresi hiç çıkmaz ve servis dışarıya
  açılmaz (daha güvenli).
- Release'ler CI'da artık **taslak değil, otomatik yayınlanır**; bu, updater'ın
  `releases/latest` ucunun çalışması için de gereklidir.

### Düzeltildi

- Servislerin "otomatik indirme çalışmıyor" sorununun kök nedeni giderildi:
  GitHub API hız sınırı (403). Artık manifest yolu kullanıldığından açılışta
  api.github.com'a istek atılmaz.

## [0.1.8] - 2026-06-09

### Eklendi

- **Ayarlar sayfası (`/settings`).** Üst menüye sağa yaslı **Ayarlar** sekmesi
  eklendi. Proje bazında kalıcı tercihler artık `settings.json` (uygulama veri
  dizini) içinde tutulur:
  - **Varsayılan imza tercihleri:** İmzala ekranının açılış formatı (PAdES/XAdES)
    ve varsayılan XAdES türü (XAdES-BES / Counter-Signature). İmza ekranı bu
    ayarlarla önceden doldurulur.
  - **Zaman damgası sağlayıcıları:** TSA adresi, müşteri no/kullanıcı adı,
    parola, protokol (Otomatik / TÜBİTAK ESYA / standart RFC 3161), özet
    algoritması, `certReq` ve `useNonce` ile birden fazla sağlayıcı eklenip
    düzenlenebilir; varsayılan sağlayıcı seçilir. Sağlayıcı diyaloğundan
    **Kontör sorgula** ile TÜBİTAK kimlik/bağlantısı sınanabilir. Kimlik
    bilgileri yalnızca bu makinede saklanır; ajana işlem anında parametre olarak
    iletilir.
- **Zaman Damgası alma (`/timestamp`).** Üst menüye birincil **Zaman Damgası**
  sekmesi eklendi. Kayıtlı bir sağlayıcı ve belge seçilerek RFC 3161 zaman
  damgası (TÜBİTAK ESYA dahil) alınır; üretilen token TSA/zaman/seri metadata'sı
  ile gösterilir ve `.tst` olarak diske kaydedilir. TÜBİTAK sağlayıcılarında kalan
  kontör satır içi sorgulanabilir.
  - Tüm ağ çağrıları Rust (Tauri) köprüsü üzerinden yerel ajanın yeni
    uçlarına gider: `POST /timestamp/get` (binary `.tst` + `X-Timestamp-*`
    header'ları), `POST /tubitak/credit`, `GET /timestamp/status`. TSA kimlik
    bilgileri her istekte parametre olarak gönderilir, hiçbir yerde saklanmaz.
- **Sanal Kart (Dummy Card) yönetimi.** Fiziksel kart takılı olmasa bile bir
  PFX (PKCS#12) dosyası ya da PKCS#11 kütüphanesi "sanal kart" olarak masaüstü
  app içinden tanımlanabilir; ajanın `Sanal Kart Tanımla` masaüstü diyaloğu açık
  olmasa da yönetim mümkün. Tanımlar İmzala ekranındaki kart listesinde normal
  kart gibi görünür.
  - Üst menüye sağa yaslı **Sanal Kartlar** sekmesi (`/virtual-cards`) eklendi;
    tanımlı kartları listeler, yeni tanım açar, düzenler ve kaldırır.
  - PKCS#12 tanımında PFX dosyası (sürükle-bırak destekli) + parola, PKCS#11
    tanımında kütüphane yolu (`.so` / `.dll` / `.dylib`) alınır; kart adı boş
    bırakılırsa dosyadan otomatik üretilir.
  - **Düzenleme:** Ajanda güncelleme ucu olmadığından düzenleme, eski kaydı
    silip yeniden tanımlama olarak yürür. Veri kaybını azaltmak için ad
    değiştiyse önce yeni kayıt eklenir sonra eski silinir; ad aynıysa önce silinip
    yeniden kaydedilir. PFX baytları/parolası ajandan geri okunamadığı için
    PKCS#12 düzenlemesinde bunlar yeniden istenir.
  - Tüm ağ çağrıları Rust (Tauri) köprüsü üzerinden yerel ajana
    (`POST /smartcard/virtual/pkcs11`, `POST /smartcard/virtual/pkcs12`,
    `GET /smartcard/virtual`, `DELETE /smartcard/virtual/{name}`) gider; PFX
    parolası yalnızca tanım anında ajana iletilir, masaüstü app'te saklanmaz.

### Değiştirildi

- Üst menü iki gruba ayrıldı: birincil gezinme (Genel Bakış · İmzala · Doğrula ·
  Zaman Damgası) solda, ikincil gezinme (Sanal Kartlar · Tanılama · Ayarlar)
  sağa yaslı.

[Unreleased]: https://github.com/mersel-dss/mersel-dss-agent-desktop-app/compare/v0.1.10...HEAD
[0.1.10]: https://github.com/mersel-dss/mersel-dss-agent-desktop-app/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/mersel-dss/mersel-dss-agent-desktop-app/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/mersel-dss/mersel-dss-agent-desktop-app/compare/v0.1.0...v0.1.8
