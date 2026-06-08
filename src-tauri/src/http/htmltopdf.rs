//! HTML-to-PDF servis istemcisi.

use crate::error::{AppError, AppResult};
use crate::http::{base_url, ensure_success, long_client};

/// HTML baytlarını HTML-to-PDF servisinin `/convert` endpoint'i ile PDF'e çevirir.
pub async fn convert_html(port: u16, html: Vec<u8>, file_name: &str) -> AppResult<Vec<u8>> {
    let part = reqwest::multipart::Part::bytes(html)
        .file_name(file_name.to_string())
        .mime_str("text/html; charset=utf-8")
        .map_err(AppError::from)?;
    let form = reqwest::multipart::Form::new().part("file", part);
    let url = format!(
        "{}/convert?smartShrinking=true&printBackground=true",
        base_url(port)
    );

    let resp = long_client()?.post(url).multipart(form).send().await?;
    let resp = ensure_success(resp).await?;
    let bytes = resp.bytes().await?;
    Ok(bytes.to_vec())
}
