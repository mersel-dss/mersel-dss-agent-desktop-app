//! İmza ajanı tanılama (diagnostics) REST istemcisi.
//! Tüm uçlar PIN harcamaz, kart sayacını etkilemez.

use super::{base_url, ensure_success, long_client};
use crate::error::AppResult;
use std::path::Path;

/// Bellek içi trace kayıtlarını listeler. `GET /diagnostics/traces`
pub async fn list_traces(port: u16, limit: u32, error_only: bool) -> AppResult<serde_json::Value> {
    let url = format!("{}/diagnostics/traces", base_url(port));
    let resp = long_client()?
        .get(url)
        .query(&[
            ("limit", limit.to_string()),
            ("errorOnly", error_only.to_string()),
        ])
        .send()
        .await?;
    Ok(ensure_success(resp).await?.json().await?)
}

/// Trace buffer'ını temizler. `DELETE /diagnostics/traces`
pub async fn clear_traces(port: u16) -> AppResult<serde_json::Value> {
    let url = format!("{}/diagnostics/traces", base_url(port));
    let resp = ensure_success(long_client()?.delete(url).send().await?).await?;
    Ok(resp.json().await?)
}

/// Trace recorder'ı açar/kapatır. `POST /diagnostics/traces/enabled?enabled=`
pub async fn set_traces_enabled(port: u16, enabled: bool) -> AppResult<serde_json::Value> {
    let url = format!("{}/diagnostics/traces/enabled", base_url(port));
    let resp = long_client()?
        .post(url)
        .query(&[("enabled", enabled.to_string())])
        .send()
        .await?;
    Ok(ensure_success(resp).await?.json().await?)
}

/// PIN'siz dry-run imza tanılaması. `POST /diagnostics/sign-probe`
pub async fn sign_probe(
    port: u16,
    terminal_name: &str,
    pkcs11_library_path: Option<&str>,
    card_type: Option<&str>,
) -> AppResult<serde_json::Value> {
    let mut query: Vec<(&str, String)> = vec![("terminalName", terminal_name.to_string())];
    if let Some(lib) = pkcs11_library_path {
        query.push(("pkcs11LibraryPath", lib.to_string()));
    }
    if let Some(ct) = card_type {
        query.push(("cardType", ct.to_string()));
    }

    let url = format!("{}/diagnostics/sign-probe", base_url(port));
    let resp = long_client()?.post(url).query(&query).send().await?;
    Ok(ensure_success(resp).await?.json().await?)
}

/// Destek paketi ZIP'ini indirir ve `dest`'e yazar. `GET /diagnostics/support-bundle`
pub async fn download_support_bundle(port: u16, dest: &Path) -> AppResult<()> {
    let url = format!("{}/diagnostics/support-bundle", base_url(port));
    let resp = ensure_success(long_client()?.get(url).send().await?).await?;
    let bytes = resp.bytes().await?;
    tokio::fs::write(dest, &bytes).await?;
    Ok(())
}
