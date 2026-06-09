//! Uygulama ayarları kalıcılığı. Varsayılan imza tercihleri ve zaman damgası
//! sağlayıcı bilgileri uygulama veri dizinindeki `settings.json` dosyasında
//! tutulur. Şema tamamen frontend'e aittir; burada opak JSON olarak saklanır.

use super::app_data_dir;
use crate::error::{AppError, AppResult};
use std::path::PathBuf;
use tauri::AppHandle;

/// Ayar dosyasının (`<app_data_dir>/settings.json`) yolunu çözer.
fn settings_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

/// Kayıtlı ayarları okur. Dosya yoksa `null` döner (frontend varsayılanı uygular).
#[tauri::command]
pub async fn load_app_settings(app: AppHandle) -> AppResult<serde_json::Value> {
    let path = settings_path(&app)?;
    match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let value = serde_json::from_slice::<serde_json::Value>(&bytes)
                .unwrap_or(serde_json::Value::Null);
            Ok(value)
        }
        Err(_) => Ok(serde_json::Value::Null),
    }
}

/// Ayarları `settings.json`'a (pretty JSON) yazar. Dizin yoksa oluşturulur.
#[tauri::command]
pub async fn save_app_settings(app: AppHandle, settings: serde_json::Value) -> AppResult<()> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let bytes = serde_json::to_vec_pretty(&settings).map_err(|e| AppError::Io(e.to_string()))?;
    tokio::fs::write(&path, bytes).await?;
    Ok(())
}
