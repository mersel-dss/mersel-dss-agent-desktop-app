//! İmza komutları: akıllı kart/sertifika listeleme ve PAdES/XAdES imzalama.

use super::running_port;
use crate::error::AppResult;
use crate::http::agent;
use crate::models::ServiceKind;
use crate::state::AppState;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

/// İmzalı çıktıyı yazacağımız yolu çözer. `output_path` verilmişse onu kullanır;
/// verilmemişse OS geçici dizininde benzersiz bir dosya üretir (kayıt yolu imza
/// tamamlandıktan sonra kullanıcıya sorulup dosya oraya taşınır).
fn resolve_output(output_path: Option<String>, ext: &str) -> PathBuf {
    if let Some(p) = output_path {
        return PathBuf::from(p);
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("mersel-signed-{nanos}.{ext}"))
}

/// Bağlı akıllı kartları ve okuyucuları listeler.
#[tauri::command]
pub async fn list_smartcards(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    agent::list_smartcards(port).await
}

/// Karttaki sertifikaları PIN sormadan listeler.
#[tauri::command]
pub async fn list_certificates(
    state: State<'_, AppState>,
    terminal_name: String,
    purpose: Option<String>,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    let purpose = purpose.unwrap_or_else(|| "SIGNING".to_string());
    agent::list_certificates(port, &terminal_name, &purpose).await
}

/// PDF'i PAdES-B ile imzalar; imzalı dosyayı yazar ve yazılan yolu döner.
/// `output_path` verilmezse geçici bir dosyaya yazılır (kayıt yeri sonradan sorulur).
#[tauri::command]
pub async fn sign_pades(
    state: State<'_, AppState>,
    content_path: String,
    terminal_name: String,
    certificate_id: String,
    pin: String,
    output_path: Option<String>,
) -> AppResult<String> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    let signed = agent::sign_pades(
        port,
        Path::new(&content_path),
        &terminal_name,
        &certificate_id,
        &pin,
    )
    .await?;
    let target = resolve_output(output_path, "pdf");
    tokio::fs::write(&target, &signed).await?;
    Ok(target.to_string_lossy().into_owned())
}

/// XML'i XAdES ile imzalar; imzalı dosyayı yazar ve yazılan yolu döner.
/// `content_type`: `XADES_BES` veya `COUNTER_SIGNATURE`.
/// `output_path` verilmezse geçici bir dosyaya yazılır (kayıt yeri sonradan sorulur).
#[tauri::command]
pub async fn sign_xades(
    state: State<'_, AppState>,
    content_path: String,
    terminal_name: String,
    certificate_id: String,
    pin: String,
    content_type: Option<String>,
    output_path: Option<String>,
) -> AppResult<String> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    let content_type = content_type.unwrap_or_else(|| "XADES_BES".to_string());
    let signed = agent::sign_xades(
        port,
        Path::new(&content_path),
        &terminal_name,
        &certificate_id,
        &pin,
        &content_type,
    )
    .await?;
    let target = resolve_output(output_path, "xml");
    tokio::fs::write(&target, &signed).await?;
    Ok(target.to_string_lossy().into_owned())
}
