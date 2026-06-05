//! Kurulu servis jar'larının sürüm üst verisi.
//!
//! Her servis dizininde `installed.json` tutulur: hangi release tag'inin ve jar
//! dosyasının kurulu olduğunu kaydeder. Otomatik güncelleme, yerel tag ile
//! GitHub'daki en güncel tag'i karşılaştırarak gereksiz indirmeyi önler.

use crate::config;
use crate::models::ServiceKind;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Bir servisin kurulu sürüm bilgisi.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledMeta {
    /// Kurulu release etiketi (örn. `v1.4.2`).
    pub tag: String,
    /// Kurulu jar dosyasının adı.
    pub jar_name: String,
}

/// Servisin kurulu sürüm üst verisini okur (yoksa `None`).
pub fn read(app_data_dir: &Path, kind: ServiceKind) -> Option<InstalledMeta> {
    let path = config::installed_meta_path(app_data_dir, kind);
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// Servisin kurulu sürüm üst verisini yazar.
pub async fn write(
    app_data_dir: &Path,
    kind: ServiceKind,
    meta: &InstalledMeta,
) -> std::io::Result<()> {
    let path = config::installed_meta_path(app_data_dir, kind);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let json = serde_json::to_vec_pretty(meta).unwrap_or_default();
    tokio::fs::write(path, json).await
}

/// Yerel kurulum, verilen `latest_tag`'e göre güncel mi?
/// Kurulum yoksa veya tag farklıysa güncelleme gerekir.
pub fn is_up_to_date(app_data_dir: &Path, kind: ServiceKind, latest_tag: &str) -> bool {
    match read(app_data_dir, kind) {
        Some(meta) => meta.tag == latest_tag && !latest_tag.is_empty(),
        None => false,
    }
}
