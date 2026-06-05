//! Servis tanımları (descriptor) ve uygulama dosya yolları.
//! Her yönetilen Java servisi sabit bir descriptor ile tanımlanır.

use crate::models::ServiceKind;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Bir Java servisinin statik tanımı.
#[derive(Debug, Clone)]
pub struct ServiceDescriptor {
    pub kind: ServiceKind,
    pub display_name: &'static str,
    pub repo_owner: &'static str,
    pub repo_name: &'static str,
    /// Release asset adının başlangıcı, örn. "mersel-dss-agent-signer-api".
    pub jar_prefix: &'static str,
    /// Varsayılan dinleme portu.
    pub default_port: u16,
}

pub const AGENT: ServiceDescriptor = ServiceDescriptor {
    kind: ServiceKind::Agent,
    display_name: "Mersel İmza Ajanı",
    repo_owner: "mersel-dss",
    repo_name: "mersel-dss-agent-signer-java",
    jar_prefix: "mersel-dss-agent-signer-api",
    default_port: 15212,
};

pub const VERIFIER: ServiceDescriptor = ServiceDescriptor {
    kind: ServiceKind::Verifier,
    display_name: "Mersel Doğrulama Servisi",
    repo_owner: "mersel-dss",
    repo_name: "mersel-dss-verifier-api-java",
    jar_prefix: "mersel-dss-verifier-api",
    default_port: 8086,
};

pub const ALL_SERVICES: [ServiceDescriptor; 2] = [AGENT, VERIFIER];

pub fn descriptor_for(kind: ServiceKind) -> ServiceDescriptor {
    match kind {
        ServiceKind::Agent => AGENT,
        ServiceKind::Verifier => VERIFIER,
    }
}

/// Belirli bir servisin jar dosyalarının saklandığı dizin.
pub fn jars_dir(app_data_dir: &Path, kind: ServiceKind) -> PathBuf {
    app_data_dir.join("services").join(kind.as_str())
}

/// Bir servisin kurulu sürüm üst verisini (installed.json) tutan dosya.
pub fn installed_meta_path(app_data_dir: &Path, kind: ServiceKind) -> PathBuf {
    jars_dir(app_data_dir, kind).join("installed.json")
}

/// Uygulamayla paketlenmiş JRE kök dizinini çözer (varsa).
///
/// Sıra:
/// 1. `MERSEL_JRE_HOME` ortam değişkeni (geliştirme/test override'ı).
/// 2. `<resource_dir>/jre` — `tauri.conf.json` `bundle.resources` ile paketlenir.
///
/// Dizin yoksa `None` döner; bu durumda sistem Java'sına düşülür.
pub fn bundled_jre_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(path) = std::env::var("MERSEL_JRE_HOME") {
        let dir = PathBuf::from(path);
        if dir.join("bin").exists() {
            return Some(dir);
        }
    }
    let resource_dir = app.path().resource_dir().ok()?;
    let dir = resource_dir.join("jre");
    if dir.join("bin").exists() {
        Some(dir)
    } else {
        None
    }
}
