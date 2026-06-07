//! Rust <-> frontend ortak veri modelleri.
//! Tüm tipler `camelCase` olarak serialize edilir; TypeScript tarafıyla birebir eşleşir.

use serde::{Deserialize, Serialize};

/// Yönetilen Java servisinin türü.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ServiceKind {
    /// Yereldeki mali mühre erişen imza ajanı (port 15212).
    Agent,
    /// İmza/zaman damgası doğrulama servisi (port 8086).
    Verifier,
}

impl ServiceKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ServiceKind::Agent => "agent",
            ServiceKind::Verifier => "verifier",
        }
    }
}

/// Bir servisin anlık çalışma durumu.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ServiceState {
    /// Jar bulunamadı / indirilmemiş.
    NotInstalled,
    /// Yüklü ama çalışmıyor.
    Stopped,
    /// Başlatılıyor (process ayakta, henüz sağlık kontrolü geçmedi).
    Starting,
    /// Çalışıyor ve sağlık kontrolü geçiyor.
    Running,
    /// Beklenmedik şekilde sonlandı.
    Crashed,
}

/// Frontend'e dönen servis anlık görüntüsü.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceSnapshot {
    pub kind: ServiceKind,
    pub display_name: String,
    pub state: ServiceState,
    pub base_url: String,
    pub port: u16,
    /// Çözümlenen jar yolu (varsa).
    pub jar_path: Option<String>,
    /// Kurulu jar'ın sürüm etiketi (release tag), biliniyorsa.
    pub installed_tag: Option<String>,
    /// Çalışan process pid'i (varsa).
    pub pid: Option<u32>,
    /// Servis bu uygulama tarafından değil, dışarıdan (örn. terminalden)
    /// başlatılmış ve portu yanıt veriyor. Bu durumda uygulama süreci
    /// yönetemez (durduramaz), yalnızca durumu raporlar.
    pub externally_managed: bool,
    /// Son hata mesajı (varsa).
    pub last_error: Option<String>,
}

/// Java runtime tespit sonucu.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaInfo {
    pub available: bool,
    pub executable: Option<String>,
    pub version: Option<String>,
    /// Java major sürümü (8, 11, 17 ...).
    pub major: Option<u32>,
    /// Çözümlemenin kaynağı: `bundled` | `java-home` | `path`.
    pub source: Option<String>,
    /// Uygulamayla paketlenmiş gömülü JRE mi kullanılıyor?
    pub bundled: bool,
}

/// GitHub release varlığı (asset).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseAsset {
    pub name: String,
    pub download_url: String,
    pub size: u64,
}

/// GitHub release özeti.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub tag: String,
    pub name: Option<String>,
    pub published_at: Option<String>,
    pub jar_asset: Option<ReleaseAsset>,
}

/// Bir GitHub release'inin sürüm notu (changelog) girdisi. Gövde (`body`)
/// GitHub Markdown'ı olarak gelir ve frontend'de render edilir.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangelogEntry {
    /// Sürüm etiketi (örn. `v0.2.0`).
    pub tag: String,
    /// Release başlığı (varsa; çoğu zaman etiketle aynı).
    pub name: Option<String>,
    /// Markdown gövdesi (sürüm notları).
    pub body: Option<String>,
    /// Yayın tarihi (ISO-8601).
    pub published_at: Option<String>,
    /// GitHub'daki release sayfası.
    pub html_url: Option<String>,
    /// Ön sürüm (pre-release) mi?
    pub prerelease: bool,
    /// Henüz yayınlanmamış taslak mı?
    pub draft: bool,
}

/// İndirme ilerleme olayı (event ile yayınlanır).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub kind: ServiceKind,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub done: bool,
}

/// Arka planda bir servis jar'ı güncellendiğinde yayınlanan olay.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceUpdatedEvent {
    pub kind: ServiceKind,
    /// Yeni kurulan sürüm etiketi (varsa).
    pub tag: Option<String>,
    /// Güncelleme uygulanırken servis yeniden başlatıldı mı?
    pub restarted: bool,
}
