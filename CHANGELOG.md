# Değişiklik Günlüğü

Bu projedeki tüm önemli değişiklikler bu dosyada belgelenir.

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) temellidir ve
proje [Semantic Versioning](https://semver.org/lang/tr/) izler.

## [Unreleased]

### Eklendi

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

- Üst menü iki gruba ayrıldı: birincil gezinme (Genel Bakış · İmzala · Doğrula)
  solda, ikincil gezinme (Sanal Kartlar · Tanılama) sağa yaslı.

[Unreleased]: https://github.com/mersel-dss/mersel-dss-agent-desktop-app/compare/HEAD
