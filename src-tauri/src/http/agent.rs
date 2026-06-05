//! İmza ajanı (port 15212) REST istemcisi.
//! Akıllı kart listeleme, sertifika listeleme ve PAdES/XAdES imzalama.

use super::{base_url, ensure_success, file_part, long_client};
use crate::error::AppResult;
use std::path::Path;

/// Bağlı akıllı kart okuyucularını ve kartları listeler. `GET /smartcard`
pub async fn list_smartcards(port: u16) -> AppResult<serde_json::Value> {
    let url = format!("{}/smartcard", base_url(port));
    let resp = ensure_success(long_client()?.get(url).send().await?).await?;
    Ok(resp.json().await?)
}

/// Karttaki sertifikaları PIN sormadan listeler.
/// `GET /smartcard/certificate?terminalName=..&purpose=SIGNING`
pub async fn list_certificates(
    port: u16,
    terminal_name: &str,
    purpose: &str,
) -> AppResult<serde_json::Value> {
    let url = format!("{}/smartcard/certificate", base_url(port));
    let resp = long_client()?
        .get(url)
        .query(&[("terminalName", terminal_name), ("purpose", purpose)])
        .send()
        .await?;
    Ok(ensure_success(resp).await?.json().await?)
}

/// PAdES-B ile PDF imzalar. `POST /pades/sign` — imzalı PDF byte'larını döner.
pub async fn sign_pades(
    port: u16,
    content_path: &Path,
    terminal_name: &str,
    certificate_id: &str,
    pin: &str,
) -> AppResult<Vec<u8>> {
    let form = reqwest::multipart::Form::new()
        .part("content", file_part(content_path).await?)
        .text("terminalName", terminal_name.to_string())
        .text("certificateId", certificate_id.to_string())
        .text("pin", pin.to_string());

    let url = format!("{}/pades/sign", base_url(port));
    let resp = ensure_success(long_client()?.post(url).multipart(form).send().await?).await?;
    Ok(resp.bytes().await?.to_vec())
}

/// XAdES ile XML imzalar. `POST /xades/sign` — imzalı XML byte'larını döner.
/// `content_type`: `XADES_BES` veya `COUNTER_SIGNATURE`.
pub async fn sign_xades(
    port: u16,
    content_path: &Path,
    terminal_name: &str,
    certificate_id: &str,
    pin: &str,
    content_type: &str,
) -> AppResult<Vec<u8>> {
    let form = reqwest::multipart::Form::new()
        .part("content", file_part(content_path).await?)
        .text("terminalName", terminal_name.to_string())
        .text("certificateId", certificate_id.to_string())
        .text("pin", pin.to_string())
        .text("contentType", content_type.to_string());

    let url = format!("{}/xades/sign", base_url(port));
    let resp = ensure_success(long_client()?.post(url).multipart(form).send().await?).await?;
    Ok(resp.bytes().await?.to_vec())
}
