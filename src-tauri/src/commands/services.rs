//! Servis yaşam döngüsü komutları: durum, başlat/durdur, release sorgu, indir.
//! Ayrıca uygulama açılışında çalışan otomatik kurulum/güncelleme/başlatma akışı.

use super::app_data_dir;
use crate::config::{self, descriptor_for, ServiceDescriptor};
use crate::download::github;
use crate::download::version::{self, InstalledMeta};
use crate::error::{AppError, AppResult};
use crate::models::{
    DownloadProgress, ReleaseInfo, ServiceKind, ServiceSnapshot, ServiceState, ServiceUpdatedEvent,
};
use crate::process::jar;
use crate::state::AppState;
use crate::{http, java, net};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

/// Arka plan güncelleyicinin GitHub'ı yoklama aralığı.
const UPDATE_CHECK_INTERVAL: Duration = Duration::from_secs(3 * 60 * 60);

/// Tüm servislerin anlık durumunu döner.
#[tauri::command]
pub async fn list_services(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<Vec<ServiceSnapshot>> {
    let data_dir = app_data_dir(&app)?;
    let mut snapshots = Vec::new();

    // Önce manager'dan senkron bilgileri topla (kilit kısa tutulur).
    let mut sync_info = Vec::new();
    {
        let mut manager = state.manager.lock().await;
        for descriptor in config::ALL_SERVICES {
            let running = manager.is_running(descriptor.kind);
            let pid = manager.pid(descriptor.kind);
            let port = manager.port(descriptor.kind).unwrap_or(descriptor.default_port);
            let jar_path = manager
                .jar_path(descriptor.kind)
                .or_else(|| jar::resolve_jar(&config::jars_dir(&data_dir, descriptor.kind), &descriptor));
            let installed_tag = version::read(&data_dir, descriptor.kind).map(|m| m.tag);
            sync_info.push((descriptor, running, pid, port, jar_path, installed_tag));
        }
    }

    for (descriptor, running, pid, port, jar_path, installed_tag) in sync_info {
        let mut externally_managed = false;
        let state_value = if running {
            if http::is_reachable(port).await {
                ServiceState::Running
            } else {
                ServiceState::Starting
            }
        } else if http::is_reachable(descriptor.default_port).await {
            // Uygulama başlatmadı ama varsayılan port yanıt veriyor → dışarıdan çalışıyor.
            externally_managed = true;
            ServiceState::Running
        } else if jar_path.is_some() {
            ServiceState::Stopped
        } else {
            ServiceState::NotInstalled
        };

        // Dışarıdan çalışıyorsa raporlanan port varsayılan port olmalı.
        let report_port = if externally_managed {
            descriptor.default_port
        } else {
            port
        };

        snapshots.push(ServiceSnapshot {
            kind: descriptor.kind,
            display_name: descriptor.display_name.to_string(),
            state: state_value,
            base_url: http::base_url(report_port),
            port: report_port,
            jar_path: jar_path.map(|p| p.display().to_string()),
            installed_tag,
            pid,
            externally_managed,
            last_error: None,
        });
    }

    Ok(snapshots)
}

/// Java çalıştırılabilirini (paketlenmiş JRE öncelikli) ve servis jar yolunu çözer.
async fn resolve_launch(app: &AppHandle, kind: ServiceKind) -> AppResult<(String, PathBuf)> {
    let descriptor = descriptor_for(kind);
    let data_dir = app_data_dir(app)?;
    let jre_dir = config::bundled_jre_dir(app);

    let detect_jre = jre_dir.clone();
    let java_info = tokio::task::spawn_blocking(move || java::detect(detect_jre))
        .await
        .map_err(|e| AppError::ServiceStart(e.to_string()))?;
    if !java_info.available {
        return Err(AppError::JavaNotFound);
    }
    // Daemon'u konsolsuz başlatmak için uygun çalıştırılabiliri seç (Windows: javaw).
    let launcher_jre = jre_dir.clone();
    let java_exe = tokio::task::spawn_blocking(move || {
        java::resolve_java_launcher(launcher_jre.as_deref())
    })
    .await
    .map_err(|e| AppError::ServiceStart(e.to_string()))?
    .or(java_info.executable)
    .ok_or(AppError::JavaNotFound)?;

    let jars_dir = config::jars_dir(&data_dir, kind);
    let jar_path = jar::resolve_jar(&jars_dir, &descriptor)
        .ok_or_else(|| AppError::JarNotFound(jars_dir.display().to_string()))?;

    Ok((java_exe, jar_path))
}

/// Bir servisi sessiz (headless) modda, ilk boş porttan başlatır.
#[tauri::command]
pub async fn start_service(
    app: AppHandle,
    state: State<'_, AppState>,
    kind: ServiceKind,
) -> AppResult<u32> {
    let descriptor = descriptor_for(kind);
    let (java_exe, jar_path) = resolve_launch(&app, kind).await?;
    // Port çakışmasına karşı tercih edilen porttan başlayıp ilk boş porta yerleş.
    let port = net::find_free_port(descriptor.default_port);

    let mut manager = state.manager.lock().await;
    manager.start(&descriptor, &java_exe, &jar_path, port)
}

/// Bir servisi durdurur.
#[tauri::command]
pub async fn stop_service(state: State<'_, AppState>, kind: ServiceKind) -> AppResult<()> {
    let mut manager = state.manager.lock().await;
    manager.stop(kind)
}

/// İlgili servisin GitHub'daki en güncel release bilgisini döner.
#[tauri::command]
pub async fn latest_release(kind: ServiceKind) -> AppResult<ReleaseInfo> {
    let descriptor = descriptor_for(kind);
    github::latest_release(&descriptor).await
}

/// En güncel jar'ı indirir ve servis dizinine kurar.
/// İlerleme `download-progress` event'i ile yayınlanır.
#[tauri::command]
pub async fn install_service(app: AppHandle, kind: ServiceKind) -> AppResult<String> {
    let descriptor = descriptor_for(kind);
    let release = github::latest_release(&descriptor).await?;
    download_release(&app, kind, &release).await
}

/// Bir release'in jar asset'ini indirir, sürüm üst verisini yazar ve eski jar'ları temizler.
async fn download_release(
    app: &AppHandle,
    kind: ServiceKind,
    release: &ReleaseInfo,
) -> AppResult<String> {
    let descriptor = descriptor_for(kind);
    let data_dir = app_data_dir(app)?;
    let asset = release
        .jar_asset
        .clone()
        .ok_or_else(|| AppError::Invalid("Release içinde jar bulunamadı".to_string()))?;

    let dest: PathBuf = config::jars_dir(&data_dir, kind).join(&asset.name);

    let app_handle = app.clone();
    github::download_asset(&asset, &dest, move |downloaded, total| {
        let _ = app_handle.emit(
            "download-progress",
            DownloadProgress {
                kind,
                downloaded,
                total,
                done: total.map(|t| downloaded >= t).unwrap_or(false),
            },
        );
    })
    .await?;

    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            kind,
            downloaded: asset.size,
            total: Some(asset.size),
            done: true,
        },
    );

    // Kurulu sürüm üst verisini yaz ve aynı servisin eski jar'larını temizle.
    let _ = version::write(
        &data_dir,
        kind,
        &InstalledMeta {
            tag: release.tag.clone(),
            jar_name: asset.name.clone(),
        },
    )
    .await;
    cleanup_old_jars(&config::jars_dir(&data_dir, kind), &descriptor, &asset.name);

    Ok(dest.display().to_string())
}

/// Servis dizininde, yeni kurulan jar dışındaki eşleşen eski jar'ları siler.
/// Böylece "en yeni jar" çözümlemesi kararlı kalır ve disk şişmez.
fn cleanup_old_jars(dir: &Path, descriptor: &ServiceDescriptor, keep: &str) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if name == keep {
            continue;
        }
        if name.starts_with(descriptor.jar_prefix) && name.ends_with(".jar") {
            let _ = std::fs::remove_file(&path);
        }
    }
}

// ───────────────────────────── Otomatik kurulum ─────────────────────────────

/// Uygulama açılışında arka planda çalışır:
/// 1. Her servisin jar'ını en güncel sürüme getirir (yoksa indirir, eskisini günceller).
/// 2. Paketlenmiş JRE / sistem Java'sı mevcutsa servisleri ilk boş porttan başlatır.
///
/// Ağ yoksa veya bir adım başarısız olursa sessizce loglar ve devam eder;
/// uygulamanın açılışını asla bloke etmez veya çökertmez.
pub async fn auto_setup(app: AppHandle) {
    for kind in [ServiceKind::Agent, ServiceKind::Verifier] {
        if let Err(err) = ensure_latest(&app, kind).await {
            tracing::warn!(
                service = kind.as_str(),
                error = %err,
                "otomatik güncelleme atlandı"
            );
        }
    }

    // Java yoksa otomatik başlatma denenmez.
    let jre_dir = config::bundled_jre_dir(&app);
    let available = tokio::task::spawn_blocking(move || java::detect(jre_dir).available)
        .await
        .unwrap_or(false);
    if !available {
        tracing::warn!("Java bulunamadı; servisler otomatik başlatılmadı");
        return;
    }

    for kind in [ServiceKind::Agent, ServiceKind::Verifier] {
        if let Err(err) = auto_start(&app, kind).await {
            tracing::warn!(
                service = kind.as_str(),
                error = %err,
                "otomatik başlatma atlandı"
            );
        }
    }
}

/// Servisin yerel jar'ını en güncel release ile senkron tutar.
/// Zaten güncel ve jar dosyası yerindeyse indirme yapmaz.
/// Dönüş: indirme/güncelleme yapıldıysa `true`.
async fn ensure_latest(app: &AppHandle, kind: ServiceKind) -> AppResult<bool> {
    let descriptor = descriptor_for(kind);
    let data_dir = app_data_dir(app)?;
    let release = github::latest_release(&descriptor).await?;

    let jar_present =
        jar::resolve_jar(&config::jars_dir(&data_dir, kind), &descriptor).is_some();
    if jar_present && version::is_up_to_date(&data_dir, kind, &release.tag) {
        return Ok(false);
    }

    download_release(app, kind, &release).await?;
    Ok(true)
}

// ─────────────────────────── Arka plan güncelleyici ───────────────────────────

/// Uygulama açık olduğu sürece periyodik olarak (her `UPDATE_CHECK_INTERVAL`)
/// her servisin jar'ını GitHub'daki en güncel sürümle karşılaştırır; eskiyse
/// arka planda indirir ve servis bu uygulama tarafından çalışıyorsa yeni
/// sürümle yeniden başlatarak güncellemeyi uygular.
///
/// Açılıştaki ilk kontrol `auto_setup` tarafından yapıldığından, bu döngü ilk
/// (anında gelen) tick'i atlar ve bekleme süresinden sonra çalışmaya başlar.
pub async fn background_updater(app: AppHandle) {
    let mut ticker = tokio::time::interval(UPDATE_CHECK_INTERVAL);
    ticker.tick().await; // interval'in ilk tick'i hemen döner — atla.

    loop {
        ticker.tick().await;
        for kind in [ServiceKind::Agent, ServiceKind::Verifier] {
            match ensure_latest(&app, kind).await {
                Ok(true) => on_service_updated(&app, kind).await,
                Ok(false) => {}
                Err(err) => tracing::warn!(
                    service = kind.as_str(),
                    error = %err,
                    "arka plan güncelleme kontrolü başarısız"
                ),
            }
        }
    }
}

/// Bir servisin jar'ı güncellendiğinde çağrılır: çalışıyorsa yeni sürümle
/// yeniden başlatır ve frontend'e `service-updated` event'i yayınlar.
async fn on_service_updated(app: &AppHandle, kind: ServiceKind) {
    let tag = app_data_dir(app)
        .ok()
        .and_then(|dir| version::read(&dir, kind))
        .map(|meta| meta.tag);

    let restarted = restart_if_running(app, kind).await.unwrap_or_else(|err| {
        tracing::warn!(
            service = kind.as_str(),
            error = %err,
            "güncellenen servis yeniden başlatılamadı"
        );
        false
    });

    tracing::info!(
        service = kind.as_str(),
        tag = tag.as_deref().unwrap_or("?"),
        restarted,
        "servis jar'ı güncellendi"
    );
    let _ = app.emit(
        "service-updated",
        ServiceUpdatedEvent { kind, tag, restarted },
    );
}

/// Servis bu uygulama tarafından çalışıyorsa durdurup yeni jar ile ilk boş
/// porttan yeniden başlatır. Dönüş: yeniden başlatma yapıldıysa `true`.
/// Çalışmıyorsa hiçbir şey yapmaz (yeni jar bir sonraki başlatmada kullanılır).
async fn restart_if_running(app: &AppHandle, kind: ServiceKind) -> AppResult<bool> {
    let descriptor = descriptor_for(kind);

    {
        let state = app.state::<AppState>();
        let mut manager = state.manager.lock().await;
        if !manager.is_running(kind) {
            return Ok(false);
        }
        manager.stop(kind)?;
    }

    let (java_exe, jar_path) = resolve_launch(app, kind).await?;
    let port = net::find_free_port(descriptor.default_port);

    let state = app.state::<AppState>();
    let mut manager = state.manager.lock().await;
    manager.start(&descriptor, &java_exe, &jar_path, port)?;
    Ok(true)
}

/// Servisi otomatik başlatır. Dışarıdan (varsayılan portta) ya da bu uygulama
/// tarafından zaten çalışıyorsa hiçbir şey yapmaz.
async fn auto_start(app: &AppHandle, kind: ServiceKind) -> AppResult<()> {
    let descriptor = descriptor_for(kind);

    // Dışarıdan başlatılmış olabilir — varsayılan port yanıt veriyorsa dokunma.
    if http::is_reachable(descriptor.default_port).await {
        return Ok(());
    }

    {
        let state = app.state::<AppState>();
        let mut manager = state.manager.lock().await;
        if manager.is_running(kind) {
            return Ok(());
        }
    }

    let (java_exe, jar_path) = resolve_launch(app, kind).await?;
    let port = net::find_free_port(descriptor.default_port);

    let state = app.state::<AppState>();
    let mut manager = state.manager.lock().await;
    manager.start(&descriptor, &java_exe, &jar_path, port)?;
    Ok(())
}
