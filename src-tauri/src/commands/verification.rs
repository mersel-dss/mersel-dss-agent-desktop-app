//! Doğrulama komutları: imza ve zaman damgası doğrulama.

use super::running_port;
use crate::error::AppResult;
use crate::http::verifier;
use crate::models::ServiceKind;
use crate::state::AppState;
use std::path::{Path, PathBuf};
use tauri::State;

fn opt_path(value: &Option<String>) -> Option<PathBuf> {
    value.as_ref().map(PathBuf::from)
}

/// İmzalı dokümanı doğrular. `level`: `SIMPLE` | `COMPREHENSIVE`.
/// `include_failed_constraints`: kapsamlı doğrulama detayı (tüm FAIL constraint'leri).
#[tauri::command]
pub async fn verify_signature(
    state: State<'_, AppState>,
    signed_path: String,
    original_path: Option<String>,
    level: Option<String>,
    include_failed_constraints: Option<bool>,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Verifier).await?;
    let level = level.unwrap_or_else(|| "COMPREHENSIVE".to_string());
    let original = opt_path(&original_path);
    verifier::verify_signature(
        port,
        Path::new(&signed_path),
        original.as_deref(),
        &level,
        include_failed_constraints.unwrap_or(false),
    )
    .await
}

/// RFC 3161 zaman damgasını doğrular.
#[tauri::command]
pub async fn verify_timestamp(
    state: State<'_, AppState>,
    timestamp_path: String,
    original_path: Option<String>,
    validate_certificate: Option<bool>,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Verifier).await?;
    let original = opt_path(&original_path);
    verifier::verify_timestamp(
        port,
        Path::new(&timestamp_path),
        original.as_deref(),
        validate_certificate.unwrap_or(true),
    )
    .await
}
