//! Doğrulama servisi (port 8086) REST istemcisi.
//! İmza ve zaman damgası doğrulama.

use super::{base_url, ensure_success, file_part, long_client};
use crate::error::AppResult;
use std::path::Path;

/// Birleşik imza doğrulama. `POST /api/v1/verify/signature`
/// `level`: `SIMPLE` veya `COMPREHENSIVE`.
/// `include_failed_constraints`: her imza için tüm BBB FAIL constraint'lerini
/// (ROOT_CAUSE + DERIVED + CASCADE) `failedConstraints` alanında ister —
/// İmzager benzeri kapsamlı doğrulama-detayı görünümü için.
pub async fn verify_signature(
    port: u16,
    signed_path: &Path,
    original_path: Option<&Path>,
    level: &str,
    include_failed_constraints: bool,
) -> AppResult<serde_json::Value> {
    let mut form = reqwest::multipart::Form::new()
        .part("signedDocument", file_part(signed_path).await?)
        .text("level", level.to_string())
        .text(
            "includeFailedConstraints",
            include_failed_constraints.to_string(),
        );

    if let Some(original) = original_path {
        form = form.part("originalDocument", file_part(original).await?);
    }

    let url = format!("{}/api/v1/verify/signature", base_url(port));
    let resp = ensure_success(long_client()?.post(url).multipart(form).send().await?).await?;
    Ok(resp.json().await?)
}

/// RFC 3161 zaman damgası doğrulama. `POST /api/v1/verify/timestamp`
pub async fn verify_timestamp(
    port: u16,
    timestamp_path: &Path,
    original_path: Option<&Path>,
    validate_certificate: bool,
) -> AppResult<serde_json::Value> {
    let mut form = reqwest::multipart::Form::new()
        .part("timestampFile", file_part(timestamp_path).await?)
        .text("validateCertificate", validate_certificate.to_string());

    if let Some(original) = original_path {
        form = form.part("originalData", file_part(original).await?);
    }

    let url = format!("{}/api/v1/verify/timestamp", base_url(port));
    let resp = ensure_success(long_client()?.post(url).multipart(form).send().await?).await?;
    Ok(resp.json().await?)
}
