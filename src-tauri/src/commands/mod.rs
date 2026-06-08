//! Frontend'e açılan Tauri komutları.

pub mod diagnostics;
pub mod export;
pub mod preview;
pub mod services;
pub mod signing;
pub mod system;
pub mod validation;
pub mod verification;
pub mod virtualcards;

use crate::config::descriptor_for;
use crate::error::{AppError, AppResult};
use crate::http;
use crate::models::ServiceKind;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Uygulama veri dizinini çözer (servis jar'ları burada saklanır).
pub(crate) fn app_data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))
}

/// Çalışan bir servisin portunu döner; çalışmıyorsa hata verir.
///
/// Önce uygulamanın kendi başlattığı (managed) süreci kontrol eder. Yoksa
/// servis dışarıdan (örn. terminalden) başlatılmış olabilir: varsayılan portu
/// yoklar, yanıt veriyorsa onu kullanır. Böylece dashboard'da "çalışıyor"
/// görünen dış servisle doğrulama/imzalama da yapılabilir.
pub(crate) async fn running_port(state: &AppState, kind: ServiceKind) -> AppResult<u16> {
    {
        let mut manager = state.manager.lock().await;
        if manager.is_running(kind) {
            return manager
                .port(kind)
                .ok_or_else(|| AppError::Invalid("Servis portu çözülemedi.".to_string()));
        }
    }

    // Managed değil — dışarıdan çalışıyor olabilir, varsayılan portu yokla.
    let default_port = descriptor_for(kind).default_port;
    if http::is_reachable(default_port).await {
        return Ok(default_port);
    }

    Err(AppError::Invalid(format!(
        "'{}' servisi çalışmıyor. Önce başlatın.",
        kind.as_str()
    )))
}
