//! Tanılama komutları: trace kayıtları, dry-run imza probu, destek paketi.
//! Hepsi imza ajanına (agent) bağlanır ve PIN harcamaz.

use super::running_port;
use crate::error::AppResult;
use crate::http::diagnostics;
use crate::models::ServiceKind;
use crate::state::AppState;
use tauri::State;

/// Bellek içi trace kayıtlarını listeler.
#[tauri::command]
pub async fn list_traces(
    state: State<'_, AppState>,
    limit: Option<u32>,
    error_only: Option<bool>,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    diagnostics::list_traces(port, limit.unwrap_or(100), error_only.unwrap_or(false)).await
}

/// Trace buffer'ını temizler.
#[tauri::command]
pub async fn clear_traces(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    diagnostics::clear_traces(port).await
}

/// Trace recorder'ı açar/kapatır.
#[tauri::command]
pub async fn set_traces_enabled(
    state: State<'_, AppState>,
    enabled: bool,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    diagnostics::set_traces_enabled(port, enabled).await
}

/// PIN'siz dry-run imza tanılaması çalıştırır.
#[tauri::command]
pub async fn sign_probe(
    state: State<'_, AppState>,
    terminal_name: String,
    pkcs11_library_path: Option<String>,
    card_type: Option<String>,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    diagnostics::sign_probe(
        port,
        &terminal_name,
        pkcs11_library_path.as_deref(),
        card_type.as_deref(),
    )
    .await
}

/// Destek paketi ZIP'ini `output_path`'e indirir ve yolunu döner.
#[tauri::command]
pub async fn download_support_bundle(
    state: State<'_, AppState>,
    output_path: String,
) -> AppResult<String> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    diagnostics::download_support_bundle(port, std::path::Path::new(&output_path)).await?;
    Ok(output_path)
}
