# Değişiklik Günlüğü

Bu projedeki tüm önemli değişiklikler bu dosyada belgelenir.

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) temellidir ve
proje [Semantic Versioning](https://semver.org/lang/tr/) izler.

## [Unreleased]

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

[Unreleased]: https://github.com/mersel-dss/mersel-dss-agent-desktop-app/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/mersel-dss/mersel-dss-agent-desktop-app/compare/v0.1.0...v0.1.8
