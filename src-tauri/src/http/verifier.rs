//! Doğrulama servisi (port 8086) REST istemcisi.
//! İmza ve zaman damgası doğrulama.

use super::{base_url, bytes_part, ensure_success, file_part, long_client};
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
    let signed = file_part(signed_path).await?;
    let original = match original_path {
        Some(p) => Some(file_part(p).await?),
        None => None,
    };
    verify_signature_part(port, signed, original, level, include_failed_constraints).await
}

/// Bellekteki imzalı içeriği doğrular (diske yazmadan). Zarf içinden çıkarılan
/// belgeleri tek tek doğrulamak için kullanılır.
pub async fn verify_signature_bytes(
    port: u16,
    signed_bytes: Vec<u8>,
    file_name: &str,
    level: &str,
    include_failed_constraints: bool,
) -> AppResult<serde_json::Value> {
    let signed = bytes_part(signed_bytes, file_name)?;
    verify_signature_part(port, signed, None, level, include_failed_constraints).await
}

async fn verify_signature_part(
    port: u16,
    signed: reqwest::multipart::Part,
    original: Option<reqwest::multipart::Part>,
    level: &str,
    include_failed_constraints: bool,
) -> AppResult<serde_json::Value> {
    let mut form = reqwest::multipart::Form::new()
        .part("signedDocument", signed)
        .text("level", level.to_string())
        .text(
            "includeFailedConstraints",
            include_failed_constraints.to_string(),
        );

    if let Some(original) = original {
        form = form.part("originalDocument", original);
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
