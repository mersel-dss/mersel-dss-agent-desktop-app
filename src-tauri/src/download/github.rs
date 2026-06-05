//! GitHub Releases üzerinden servis jar'larını keşfeder ve indirir.

use crate::config::ServiceDescriptor;
use crate::error::{AppError, AppResult};
use crate::models::{ReleaseAsset, ReleaseInfo};
use futures_util::StreamExt;
use std::path::Path;
use tokio::io::AsyncWriteExt;

const USER_AGENT: &str = "mersel-dss-agent-desktop";

fn client() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(AppError::from)
}

/// İlgili servisin GitHub'daki en güncel release'ini ve jar asset'ini döner.
pub async fn latest_release(descriptor: &ServiceDescriptor) -> AppResult<ReleaseInfo> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        descriptor.repo_owner, descriptor.repo_name
    );
    let resp = client()?.get(&url).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::ServiceResponse {
            status: resp.status().as_u16(),
            body: "GitHub release bilgisi alınamadı".to_string(),
        });
    }
    let json: serde_json::Value = resp.json().await?;
    Ok(parse_release(&json, descriptor))
}

fn parse_release(json: &serde_json::Value, descriptor: &ServiceDescriptor) -> ReleaseInfo {
    let tag = json
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let name = json
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let published_at = json
        .get("published_at")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let jar_asset = json
        .get("assets")
        .and_then(|v| v.as_array())
        .and_then(|assets| {
            assets.iter().find_map(|a| {
                let asset_name = a.get("name")?.as_str()?;
                if asset_name.starts_with(descriptor.jar_prefix) && asset_name.ends_with(".jar") {
                    Some(ReleaseAsset {
                        name: asset_name.to_string(),
                        download_url: a
                            .get("browser_download_url")?
                            .as_str()?
                            .to_string(),
                        size: a.get("size").and_then(|s| s.as_u64()).unwrap_or(0),
                    })
                } else {
                    None
                }
            })
        });

    ReleaseInfo {
        tag,
        name,
        published_at,
        jar_asset,
    }
}

/// Bir asset'i hedef dosyaya stream ederek indirir. İlerleme `on_progress` ile bildirilir.
pub async fn download_asset<F>(
    asset: &ReleaseAsset,
    dest: &Path,
    on_progress: F,
) -> AppResult<()>
where
    F: Fn(u64, Option<u64>),
{
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let resp = client()?.get(&asset.download_url).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::ServiceResponse {
            status: resp.status().as_u16(),
            body: "Jar indirilemedi".to_string(),
        });
    }

    let total = resp.content_length().or(if asset.size > 0 {
        Some(asset.size)
    } else {
        None
    });

    // Yarım kalmış indirme bozuk jar bırakmasın diye önce .part dosyasına yaz.
    let part = dest.with_extension("part");
    let mut file = tokio::fs::File::create(&part).await?;
    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;
        on_progress(downloaded, total);
    }
    file.flush().await?;
    drop(file);

    tokio::fs::rename(&part, dest).await?;
    Ok(())
}
