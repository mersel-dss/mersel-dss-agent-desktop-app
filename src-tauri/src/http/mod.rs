//! Çalışan Java servislerine HTTP ile konuşan istemciler.

pub mod agent;
pub mod diagnostics;
pub mod verifier;

use crate::error::{AppError, AppResult};
use std::path::Path;
use std::time::Duration;

/// Servis temel URL'i.
pub fn base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

/// Kısa zaman aşımlı istemci — imza/doğrulama gibi uzun işlemler için kullanılır.
pub fn long_client() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(AppError::from)
}

/// Servisin HTTP'ye yanıt verip vermediğini kontrol eder.
/// Herhangi bir HTTP yanıtı (404 dahil) "ayakta" sayılır.
pub async fn is_reachable(port: u16) -> bool {
    let Ok(client) = reqwest::Client::builder()
        .timeout(Duration::from_millis(1500))
        .build()
    else {
        return false;
    };
    client.get(base_url(port)).send().await.is_ok()
}

/// Bir dosyayı multipart `Part` olarak yükler (octet-stream).
pub(crate) async fn file_part(
    path: &Path,
) -> AppResult<reqwest::multipart::Part> {
    let bytes = tokio::fs::read(path).await?;
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    reqwest::multipart::Part::bytes(bytes)
        .file_name(file_name)
        .mime_str("application/octet-stream")
        .map_err(AppError::from)
}

/// Başarısız HTTP yanıtını `AppError`'a çevirir.
pub(crate) async fn ensure_success(resp: reqwest::Response) -> AppResult<reqwest::Response> {
    if resp.status().is_success() {
        Ok(resp)
    } else {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        Err(AppError::ServiceResponse { status, body })
    }
}
