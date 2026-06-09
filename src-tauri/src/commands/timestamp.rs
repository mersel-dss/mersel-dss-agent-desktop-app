//! Zaman damgası komutları: RFC 3161 token alma (TÜBİTAK ESYA dahil) ve
//! TÜBİTAK kontör sorgulama. İmza ajanının (`/timestamp/*`, `/tubitak/*`)
//! uçlarını kullanır; TSA kimlik bilgileri her istekte parametre gönderilir.

use super::running_port;
use crate::error::AppResult;
use crate::http::agent;
use crate::models::ServiceKind;
use crate::state::AppState;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

/// `create_timestamp` çıktısı: alınan token geçici bir `.tst` dosyasına yazılır;
/// frontend bu yolu kullanıcı seçtiği konuma taşır. Metadata sonucu özetler.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimestampCreation {
    /// Token'ın yazıldığı geçici dosya yolu (kayıt yeri sonradan sorulur).
    pub temp_path: String,
    pub timestamp: Option<String>,
    pub tsa_name: Option<String>,
    pub serial_number: Option<String>,
    pub hash_algorithm: Option<String>,
    pub nonce: Option<String>,
}

/// Token'ı yazacağımız geçici dosya yolunu üretir.
fn temp_token_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("mersel-timestamp-{nanos}.tst"))
}

/// Verilen belge için zaman damgası alır; token'ı geçici `.tst` dosyasına yazıp
/// metadata ile birlikte döner. Kimlik bilgileri ajan'a parametre gönderilir,
/// hiçbir yerde saklanmaz.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_timestamp(
    state: State<'_, AppState>,
    document_path: String,
    hash_algorithm: Option<String>,
    tsa_url: String,
    ts_user_id: Option<String>,
    ts_user_password: Option<String>,
    tubitak: Option<bool>,
    cert_req: Option<bool>,
    use_nonce: Option<bool>,
) -> AppResult<TimestampCreation> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    let hash_algorithm = hash_algorithm.unwrap_or_else(|| "SHA256".to_string());
    let cert_req = cert_req.unwrap_or(true);
    let use_nonce = use_nonce.unwrap_or(false);

    let result = agent::get_timestamp(
        port,
        Path::new(&document_path),
        &hash_algorithm,
        &tsa_url,
        ts_user_id.as_deref(),
        ts_user_password.as_deref(),
        tubitak,
        cert_req,
        use_nonce,
    )
    .await?;

    let target = temp_token_path();
    tokio::fs::write(&target, &result.token).await?;

    Ok(TimestampCreation {
        temp_path: target.to_string_lossy().into_owned(),
        timestamp: result.timestamp,
        tsa_name: result.tsa_name,
        serial_number: result.serial_number,
        hash_algorithm: result.hash_algorithm,
        nonce: result.nonce,
    })
}

/// TÜBİTAK ESYA kalan kontör miktarını sorgular. Bağlantı/kimlik testi olarak da
/// kullanılabilir.
#[tauri::command]
pub async fn check_tubitak_credit(
    state: State<'_, AppState>,
    tsa_url: String,
    ts_user_id: String,
    ts_user_password: String,
    tubitak: Option<bool>,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    agent::tubitak_credit(port, &tsa_url, &ts_user_id, &ts_user_password, tubitak).await
}

/// Ajan'ın zaman damgası özelliği durumunu döner (`/timestamp/status`).
#[tauri::command]
pub async fn timestamp_status(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    agent::timestamp_status(port).await
}
