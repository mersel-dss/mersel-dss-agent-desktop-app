//! Servis yaşam döngüsü komutları: durum, başlat/durdur, release sorgu, indir.
//! Ayrıca uygulama açılışında çalışan otomatik kurulum/güncelleme/başlatma akışı.

use super::app_data_dir;
use crate::config::{self, descriptor_for, ServiceDescriptor, ServiceRuntime};
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

/// Arka plan güncelleyicinin GitHub'ı yoklama aralığı. Güncellemeler otomatik
/// uygulandığından (indir + çalışıyorsa yeniden başlat) aralık kısa tutulur ki
/// yeni bir servis sürümü çıktığında kısa sürede devreye girsin.
const UPDATE_CHECK_INTERVAL: Duration = Duration::from_secs(30 * 60);

/// Frontend'in dinlediği event adları (TS tarafıyla birebir eşleşmelidir).
const EVENT_DOWNLOAD_PROGRESS: &str = "download-progress";
const EVENT_SERVICE_UPDATED: &str = "service-updated";

struct EnsureLatestOutcome {
    updated: bool,
    start_after_update: bool,
}

fn stamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Tüm servislerin anlık durumunu döner.
#[tauri::command]
pub async fn list_services(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<Vec<ServiceSnapshot>> {
    let data_dir = app_data_dir(&app)?;
    let mut snapshots = Vec::new();

    // Servis-başına son kurulum hatası (auto_setup / install başarısızsa dolu).
    let setup_errors = state.setup_errors.lock().await.clone();

    // Önce manager'dan senkron bilgileri topla (kilit kısa tutulur).
    let mut sync_info = Vec::new();
    {
        let mut manager = state.manager.lock().await;
        for descriptor in config::ALL_SERVICES {
            let running = manager.is_running(descriptor.kind);
            let pid = manager.pid(descriptor.kind);
            let port = manager
                .port(descriptor.kind)
                .unwrap_or(descriptor.default_port);
            let artifact_path = manager
                .jar_path(descriptor.kind)
                .or_else(|| resolve_effective_artifact(&app, &descriptor));
            // Sürüm: ÖNCE gömülü kilidi (services.lock.json), yoksa indirilmiş meta.
            let installed_tag = read_bundled_lock_tag(&app, descriptor.kind)
                .or_else(|| version::read(&data_dir, descriptor.kind).map(|m| m.tag));
            sync_info.push((descriptor, running, pid, port, artifact_path, installed_tag));
        }
    }

    for (descriptor, running, pid, port, artifact_path, installed_tag) in sync_info {
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
        } else if artifact_path.is_some() {
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
            jar_path: artifact_path.map(|p| p.display().to_string()),
            installed_tag,
            pid,
            externally_managed,
            os_managed: crate::os_service::is_installed(descriptor.kind),
            // Hatayı yalnızca kurulu olmayan servislerde göster (kurulu/çalışan
            // servis için eski bir hata mesajı asılı kalmasın).
            last_error: if matches!(state_value, ServiceState::NotInstalled) {
                setup_errors.get(&descriptor.kind).cloned()
            } else {
                None
            },
        });
    }

    Ok(snapshots)
}

/// Bir servisin son kurulum hatasını kaydeder (`Some`) veya temizler (`None`).
/// `list_services` bu haritayı okuyarak hatayı frontend'e taşır.
async fn set_setup_error(app: &AppHandle, kind: ServiceKind, msg: Option<String>) {
    let state = app.state::<AppState>();
    let mut errs = state.setup_errors.lock().await;
    match msg {
        Some(m) => {
            errs.insert(kind, m);
        }
        None => {
            errs.remove(&kind);
        }
    }
}

fn resolve_native_executable(app_data_dir: &Path, kind: ServiceKind) -> Option<PathBuf> {
    let exe = config::native_current_dir(app_data_dir, kind).join(config::native_executable_name());
    exe.exists().then_some(exe)
}

fn resolve_installed_artifact(
    app_data_dir: &Path,
    descriptor: &ServiceDescriptor,
) -> Option<PathBuf> {
    match descriptor.runtime {
        ServiceRuntime::Java { .. } => {
            jar::resolve_jar(&config::jars_dir(app_data_dir, descriptor.kind), descriptor)
        }
        ServiceRuntime::NativePackage { .. } => {
            resolve_native_executable(app_data_dir, descriptor.kind)
        }
        ServiceRuntime::NativeSingleFile { .. } => {
            let exe = config::single_file_binary_path(app_data_dir, descriptor.kind);
            exe.exists().then_some(exe)
        }
    }
}

/// GÖMÜLÜ (build-time'da `pnpm fetch-services` ile paketlenmiş) artifact'ı çözer.
/// Gömülü dizin yoksa veya içinde uygun artifact yoksa `None`. Gömülü artifact
/// sürüm-kilitlidir ve çalışma anında ağ/GitHub gerektirmez.
fn resolve_bundled_artifact(app: &AppHandle, descriptor: &ServiceDescriptor) -> Option<PathBuf> {
    let dir = config::bundled_service_dir(app, descriptor.kind)?;
    match descriptor.runtime {
        ServiceRuntime::Java { .. } => jar::resolve_jar(&dir, descriptor),
        ServiceRuntime::NativePackage { .. } => {
            let exe = dir.join("current").join(config::native_executable_name());
            exe.exists().then_some(exe)
        }
        ServiceRuntime::NativeSingleFile { .. } => {
            let exe = dir.join(config::single_file_binary_name());
            exe.exists().then_some(exe)
        }
    }
}

/// Bir servisin kullanılacak artifact'ını çözer: ÖNCE gömülü (sürüm-kilitli,
/// çevrimdışı/proxy'de çalışır), yoksa indirilmiş (runtime fallback).
fn resolve_effective_artifact(app: &AppHandle, descriptor: &ServiceDescriptor) -> Option<PathBuf> {
    if let Some(p) = resolve_bundled_artifact(app, descriptor) {
        return Some(p);
    }
    let data_dir = app_data_dir(app).ok()?;
    resolve_installed_artifact(&data_dir, descriptor)
}

/// Bir servisin ŞU AN geçerli artifact sürüm etiketini döner: ÖNCE gömülü kilidi
/// (`services.lock.json` — desktop'a pinli), yoksa indirilmiş meta. OS-servisinin
/// "hangi sürümü çalıştırması gerektiği"ni belirlemek için kullanılır.
fn current_artifact_tag(app: &AppHandle, kind: ServiceKind) -> Option<String> {
    read_bundled_lock_tag(app, kind).or_else(|| {
        app_data_dir(app)
            .ok()
            .and_then(|d| version::read(&d, kind))
            .map(|m| m.tag)
    })
}

/// OS-servisinin HÂLİHAZIRDA hangi sürümle kurulduğunu tutan işaretçi dosyası.
/// Desktop app güncellenince gömülü sürüm değişir; bu işaretçiyle karşılaştırıp
/// yalnız gerçekten değiştiğinde OS-servisini yeniler (gereksiz restart olmaz).
fn os_tag_marker_path(data_dir: &Path, kind: ServiceKind) -> PathBuf {
    config::jars_dir(data_dir, kind).join("os-service.tag")
}

fn read_os_service_tag(data_dir: &Path, kind: ServiceKind) -> Option<String> {
    std::fs::read_to_string(os_tag_marker_path(data_dir, kind))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn write_os_service_tag(data_dir: &Path, kind: ServiceKind, tag: &str) {
    let path = os_tag_marker_path(data_dir, kind);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(path, tag);
}

/// Gömülü servis sürüm kilidinden (`services.lock.json`) ilgili servisin
/// release etiketini okur. Gömülü değilse / dosya yoksa `None`.
fn read_bundled_lock_tag(app: &AppHandle, kind: ServiceKind) -> Option<String> {
    let path = app
        .path()
        .resource_dir()
        .ok()?
        .join("services")
        .join("services.lock.json");
    let bytes = std::fs::read(path).ok()?;
    let json: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    json.get("services")?
        .get(kind.as_str())?
        .get("tag")?
        .as_str()
        .map(|s| s.to_string())
}

/// Java çalıştırılabilirini ve servis jar yolunu çözer.
///
/// Her servis **kendi minimum Java sürümünü** ister (imza/doğrulama Java 8,
/// XSLT önizleme Java 21). Bu yüzden servise uygun paketli JRE önceliklenir
/// (Java 21 için `jre21`, diğerleri için `jre`) ve eşiği karşılayan ilk runtime
/// (paketli → `JAVA_HOME` → `PATH`) seçilir. Uygun runtime yoksa, kullanıcıya
/// hangi Java sürümünün gerektiğini bildiren açık bir hata döner.
async fn resolve_java_launch(app: &AppHandle, kind: ServiceKind) -> AppResult<(String, PathBuf)> {
    let descriptor = descriptor_for(kind);
    let data_dir = app_data_dir(app)?;
    let min_major = descriptor
        .min_java_major()
        .ok_or_else(|| AppError::Invalid("Bu servis Java runtime kullanmıyor.".to_string()))?;
    let preferred_jre = config::bundled_jre_dir_for(app, min_major);

    // Daemon'u konsolsuz başlatmak için, minimum sürümü karşılayan launcher'ı seç.
    let launcher_jre = preferred_jre.clone();
    let java_exe = tokio::task::spawn_blocking(move || {
        java::resolve_service_launcher(launcher_jre.as_deref(), min_major)
    })
    .await
    .map_err(|e| AppError::ServiceStart(e.to_string()))?
    .ok_or_else(|| AppError::JavaVersionUnsatisfied {
        service: descriptor.display_name.to_string(),
        required: min_major,
    })?;

    // ÖNCE gömülü jar (sürüm-kilitli), yoksa indirilmiş jar.
    let jars_dir = config::jars_dir(&data_dir, kind);
    let jar_path = resolve_bundled_artifact(app, &descriptor)
        .or_else(|| jar::resolve_jar(&jars_dir, &descriptor))
        .ok_or_else(|| AppError::JarNotFound(jars_dir.display().to_string()))?;

    Ok((java_exe, jar_path))
}

fn resolve_native_launch(app: &AppHandle, kind: ServiceKind) -> AppResult<PathBuf> {
    let data_dir = app_data_dir(app)?;
    // ÖNCE gömülü native (varsa), yoksa indirilmiş.
    resolve_bundled_artifact(app, &descriptor_for(kind))
        .or_else(|| resolve_native_executable(&data_dir, kind))
        .ok_or_else(|| {
            AppError::JarNotFound(
                config::native_current_dir(&data_dir, kind)
                    .join(config::native_executable_name())
                    .display()
                    .to_string(),
            )
        })
}

/// Bir servisi çözümler (Java + jar), tercih edilen porttan başlayarak ilk boş
/// porta yerleşir ve manager üzerinden başlatır. Üç başlatma noktasının
/// (komut, otomatik başlatma, güncelleme sonrası yeniden başlatma) ortak çekirdeği.
async fn launch_service(app: &AppHandle, kind: ServiceKind) -> AppResult<u32> {
    let descriptor = descriptor_for(kind);
    let data_dir = app_data_dir(app)?;
    let port = net::find_free_port(descriptor.default_port);
    let log_path = config::launch_log_path(&data_dir, kind);

    match descriptor.runtime {
        ServiceRuntime::Java { .. } => {
            let (java_exe, jar_path) = resolve_java_launch(app, kind).await?;

            // XSLT servisi GİB doğrulama asset'lerini (XSD + schematron) kalıcı bir
            // dizinde tutar; başlatmadan önce var olduğundan emin ol.
            let assets_dir = if kind == ServiceKind::Xslt {
                let dir = config::xslt_assets_dir(&data_dir);
                let _ = tokio::fs::create_dir_all(&dir).await;
                Some(dir)
            } else {
                None
            };

            // Çalışma dizini DAİMA yazılabilir `<data_dir>/services/<kind>` olur.
            // Gömülü jar salt-okunur paket içinde olduğundan cwd olarak kullanılamaz;
            // Spring Boot logback'i göreli `./logs/...`'a buraya yazar (loglar servis
            // başına ayrışır, gömülü/indirilmiş fark etmez).
            let work_dir = config::jars_dir(&data_dir, kind);
            let _ = tokio::fs::create_dir_all(&work_dir).await;

            let state = app.state::<AppState>();
            let mut manager = state.manager.lock().await;
            manager.start_java(
                &descriptor,
                &java_exe,
                &jar_path,
                port,
                assets_dir.as_deref(),
                Some(&log_path),
                Some(&work_dir),
            )
        }
        ServiceRuntime::NativePackage { .. } => {
            let executable_path = resolve_native_launch(app, kind)?;
            let state = app.state::<AppState>();
            let mut manager = state.manager.lock().await;
            manager.start_native(&descriptor, &executable_path, port, Some(&log_path))
        }
        ServiceRuntime::NativeSingleFile { .. } => {
            let executable_path = config::single_file_binary_path(&data_dir, kind);
            if !executable_path.exists() {
                return Err(AppError::JarNotFound(executable_path.display().to_string()));
            }
            let state = app.state::<AppState>();
            let mut manager = state.manager.lock().await;
            manager.start_native(&descriptor, &executable_path, port, Some(&log_path))
        }
    }
}

/// Bir servisin OS-servis (LaunchAgent / systemd --user / Scheduled Task) olarak
/// kaydı için gereken TAM başlatma tarifi. Child-process başlatmadan farkı: port
/// SABİT default porttur (daemon'a runtime'da port verilemez) ve tüm argüman/env
/// önceden somutlaştırılır.
pub(crate) struct LaunchSpec {
    pub program: String,
    pub args: Vec<String>,
    pub envs: Vec<(String, String)>,
    pub work_dir: PathBuf,
    pub port: u16,
}

/// Bir servis için OS-servis kaydına uygun, sabit-portlu başlatma tarifi üretir.
/// Java çalıştırılabilirini + jar'ı (gömülü/indirilmiş) ve native exe'yi mevcut
/// çözümleyicilerle bulur; böylece OS-servis ile child-process aynı komutu kullanır.
pub(crate) async fn build_launch_spec(app: &AppHandle, kind: ServiceKind) -> AppResult<LaunchSpec> {
    let descriptor = descriptor_for(kind);
    let data_dir = app_data_dir(app)?;
    let port = descriptor.default_port;

    match descriptor.runtime {
        ServiceRuntime::Java { .. } => {
            let (java_exe, jar_path) = resolve_java_launch(app, kind).await?;

            let assets_dir = if kind == ServiceKind::Xslt {
                let dir = config::xslt_assets_dir(&data_dir);
                let _ = tokio::fs::create_dir_all(&dir).await;
                Some(dir)
            } else {
                None
            };

            let work_dir = config::jars_dir(&data_dir, kind);
            let _ = tokio::fs::create_dir_all(&work_dir).await;

            let mut args: Vec<String> = vec!["-Djava.awt.headless=true".to_string()];
            args.extend(
                crate::process::manager::fast_start_jvm_args()
                    .iter()
                    .map(|s| s.to_string()),
            );
            args.push("-jar".to_string());
            args.push(jar_path.display().to_string());
            args.push(format!("--server.port={port}"));
            args.push("--server.address=127.0.0.1".to_string());
            args.extend(
                crate::process::manager::application_args(kind)
                    .iter()
                    .map(|s| s.to_string()),
            );

            let envs = crate::process::manager::silent_env_vars(kind, assets_dir.as_deref());

            Ok(LaunchSpec {
                program: java_exe,
                args,
                envs,
                work_dir,
                port,
            })
        }
        ServiceRuntime::NativePackage { .. } | ServiceRuntime::NativeSingleFile { .. } => {
            let exe = resolve_native_launch(app, kind)?;
            let work_dir = exe
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| config::jars_dir(&data_dir, kind));

            let mut envs = vec![(
                "ASPNETCORE_URLS".to_string(),
                format!("http://127.0.0.1:{port}"),
            )];
            let browsers = work_dir.join("ms-playwright");
            if browsers.exists() {
                envs.push((
                    "PLAYWRIGHT_BROWSERS_PATH".to_string(),
                    browsers.display().to_string(),
                ));
            }

            Ok(LaunchSpec {
                program: exe.display().to_string(),
                args: Vec::new(),
                envs,
                work_dir,
                port,
            })
        }
    }
}

/// Bir servisi başlatır. OS-servisi olarak kuruluysa OS API'siyle başlatılır
/// (pid izlenmediğinden 0 döner); değilse child-process olarak ilk boş porttan.
#[tauri::command]
pub async fn start_service(app: AppHandle, kind: ServiceKind) -> AppResult<u32> {
    if crate::os_service::is_installed(kind) {
        crate::os_service::start(kind)?;
        return Ok(0);
    }
    launch_service(&app, kind).await
}

/// Bir servisi durdurur. OS-servisi olarak kuruluysa OS API'siyle (PID kill değil
/// — Windows'ta görev düzgün sonlandırılır); değilse yönetilen child süreci durdurur.
#[tauri::command]
pub async fn stop_service(state: State<'_, AppState>, kind: ServiceKind) -> AppResult<()> {
    if crate::os_service::is_installed(kind) {
        return crate::os_service::stop(kind);
    }
    let mut manager = state.manager.lock().await;
    manager.stop(kind)
}

/// Bir servisi yeniden başlatır (uygulama içi kontrol). OS-servisi olarak
/// kuruluysa OS API'siyle restart; değilse child süreci durdurup yeniden başlatır.
#[tauri::command]
pub async fn restart_service(
    app: AppHandle,
    state: State<'_, AppState>,
    kind: ServiceKind,
) -> AppResult<()> {
    if crate::os_service::is_installed(kind) {
        return crate::os_service::restart(kind);
    }
    {
        let mut manager = state.manager.lock().await;
        manager.stop(kind)?;
    }
    launch_service(&app, kind).await?;
    Ok(())
}

/// Tüm yönetilen servisleri durdurur ve process handle'larının (özellikle
/// Windows'ta `jre\bin\java.dll`) serbest kalmasını bekler.
///
/// KRİTİK (Windows güncelleme): NSIS kurulumu, çalışan Java alt süreçleri
/// `java.dll`'i kilitli tuttuğu için "Error opening file for writing" verip
/// dosyanın üzerine yazamıyordu. Frontend, güncellemeyi İNDİRMEDEN ÖNCE bunu
/// çağırır; böylece installer çalıştığında tüm JRE dosyaları serbesttir.
#[tauri::command]
pub async fn stop_all_services(state: State<'_, AppState>) -> AppResult<()> {
    {
        let mut manager = state.manager.lock().await;
        manager.stop_all();
    }
    // `stop()` kill+wait yapıp süreci reap etse de, Windows dosya kilidini
    // serbest bırakması bir an gecikebilir. Installer'ın java.dll'e yazabilmesi
    // için kısa bir tampon bırakıyoruz.
    tokio::time::sleep(Duration::from_millis(800)).await;
    Ok(())
}

/// Tüm servisleri İŞLETİM SİSTEMİNE kayıtlı, login'de otomatik kalkan birimler
/// olarak kurar (macOS LaunchAgent / Linux systemd --user / Windows Scheduled
/// Task). Böylece servisler arka planda sürekli sıcak kalır ve uygulama açıldığı
/// an sabit default portta hazır olur. Admin/UAC gerektirmez (kullanıcı kapsamı).
///
/// Kurmadan önce uygulamanın kendi başlattığı child süreçler durdurulur ki
/// OS-servisleri default portları çakışmasız alabilsin.
#[tauri::command]
pub async fn install_os_services(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<()> {
    {
        let mut manager = state.manager.lock().await;
        manager.stop_all();
    }
    tokio::time::sleep(Duration::from_millis(400)).await;

    let data_dir = app_data_dir(&app).ok();
    let mut errors = Vec::new();
    for kind in config::ALL_SERVICES.map(|d| d.kind) {
        match build_launch_spec(&app, kind).await {
            Ok(spec) => {
                if let Err(e) = crate::os_service::install(kind, &spec) {
                    errors.push(format!("{}: {e}", kind.as_str()));
                } else if let (Some(dir), Some(tag)) =
                    (data_dir.as_deref(), current_artifact_tag(&app, kind))
                {
                    // Sürüm işaretçisini yaz: sonraki açılışlarda desktop güncellenince
                    // OS-servisi otomatik yeni sürüme senkronlansın.
                    write_os_service_tag(dir, kind, &tag);
                }
            }
            Err(e) => errors.push(format!("{}: {e}", kind.as_str())),
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::ServiceStart(errors.join("; ")))
    }
}

/// Tüm servislerin OS-servis kaydını kaldırır (varsa durdurur). Kaldırma sonrası
/// uygulama servisleri yeniden kendi child süreci olarak yönetebilir.
#[tauri::command]
pub async fn uninstall_os_services() -> AppResult<()> {
    let mut errors = Vec::new();
    for kind in config::ALL_SERVICES.map(|d| d.kind) {
        if let Err(e) = crate::os_service::uninstall(kind) {
            errors.push(format!("{}: {e}", kind.as_str()));
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::ServiceStart(errors.join("; ")))
    }
}

/// OS-servisi olarak kurulu servislerin listesini döner (frontend bu duruma göre
/// "Servis olarak kur / kaldır" düğmesini gösterir).
#[tauri::command]
pub async fn os_services_installed() -> AppResult<Vec<ServiceKind>> {
    Ok(config::ALL_SERVICES
        .map(|d| d.kind)
        .into_iter()
        .filter(|k| crate::os_service::is_installed(*k))
        .collect())
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
    let result = async {
        let release = github::latest_release(&descriptor).await?;
        download_release(&app, kind, &release).await
    }
    .await;
    // Sonucu görünür hata haritasına yansıt (UI'da "Tekrar dene" + neden gösterimi).
    set_setup_error(
        &app,
        kind,
        result.as_ref().err().map(|e| e.to_string()),
    )
    .await;
    result
}

/// Bir servisi en güncel sürüme getirir: gerekiyorsa yeni jar'ı indirir ve
/// servis bu uygulama tarafından çalışıyorsa yeni sürümle yeniden başlatır.
/// Zaten güncelse hiçbir şey yapmaz. Dönüş: güncelleme uygulandıysa `true`.
/// Frontend, bir güncelleme tespit ettiğinde bunu otomatik çağırır.
#[tauri::command]
pub async fn update_service(app: AppHandle, kind: ServiceKind) -> AppResult<bool> {
    let outcome = ensure_latest(&app, kind).await?;
    if outcome.updated {
        on_service_updated(&app, kind, outcome.start_after_update).await;
    }
    Ok(outcome.updated)
}

/// Bir release'in jar asset'ini indirir, sürüm üst verisini yazar ve eski jar'ları temizler.
async fn download_release(
    app: &AppHandle,
    kind: ServiceKind,
    release: &ReleaseInfo,
) -> AppResult<String> {
    let descriptor = descriptor_for(kind);
    match descriptor.runtime {
        ServiceRuntime::Java { .. } => download_java_release(app, kind, &descriptor, release).await,
        ServiceRuntime::NativePackage { .. } => {
            download_native_release(app, kind, &descriptor, release).await
        }
        ServiceRuntime::NativeSingleFile { .. } => {
            download_single_file_release(app, kind, release).await
        }
    }
}

async fn download_java_release(
    app: &AppHandle,
    kind: ServiceKind,
    descriptor: &ServiceDescriptor,
    release: &ReleaseInfo,
) -> AppResult<String> {
    let data_dir = app_data_dir(app)?;
    let asset = release
        .jar_asset
        .clone()
        .ok_or_else(|| AppError::Invalid("Release içinde jar bulunamadı".to_string()))?;

    let dest: PathBuf = config::jars_dir(&data_dir, kind).join(&asset.name);

    let app_handle = app.clone();
    github::download_asset(&asset, &dest, move |downloaded, total| {
        let _ = app_handle.emit(
            EVENT_DOWNLOAD_PROGRESS,
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
        EVENT_DOWNLOAD_PROGRESS,
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
    cleanup_old_jars(&config::jars_dir(&data_dir, kind), descriptor, &asset.name);

    Ok(dest.display().to_string())
}

async fn download_native_release(
    app: &AppHandle,
    kind: ServiceKind,
    _descriptor: &ServiceDescriptor,
    release: &ReleaseInfo,
) -> AppResult<String> {
    let data_dir = app_data_dir(app)?;
    let asset = release.package_asset.clone().ok_or_else(|| {
        let suffix = config::native_package_suffix().unwrap_or("<desteklenmeyen-platform>");
        AppError::Invalid(format!(
            "Release içinde bu platforma uygun paket bulunamadı ({suffix})"
        ))
    })?;

    let service_dir = config::jars_dir(&data_dir, kind);
    let archive_path = service_dir.join(&asset.name);

    let app_handle = app.clone();
    github::download_asset(&asset, &archive_path, move |downloaded, total| {
        let _ = app_handle.emit(
            EVENT_DOWNLOAD_PROGRESS,
            DownloadProgress {
                kind,
                downloaded,
                total,
                done: total.map(|t| downloaded >= t).unwrap_or(false),
            },
        );
    })
    .await?;

    let staging_dir = service_dir.join(format!("staging-{}", stamp()));
    let current_dir = config::native_current_dir(&data_dir, kind);
    let archive_for_extract = archive_path.clone();
    let staging_for_extract = staging_dir.clone();
    let current_for_extract = current_dir.clone();
    let asset_name = asset.name.clone();

    tokio::task::spawn_blocking(move || -> AppResult<()> {
        if staging_for_extract.exists() {
            std::fs::remove_dir_all(&staging_for_extract)?;
        }
        std::fs::create_dir_all(&staging_for_extract)?;
        extract_archive(&archive_for_extract, &staging_for_extract, &asset_name)?;

        if current_for_extract.exists() {
            std::fs::remove_dir_all(&current_for_extract)?;
        }
        std::fs::rename(&staging_for_extract, &current_for_extract)?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::Invalid(e.to_string()))??;

    let _ = tokio::fs::remove_file(&archive_path).await;

    let _ = app.emit(
        EVENT_DOWNLOAD_PROGRESS,
        DownloadProgress {
            kind,
            downloaded: asset.size,
            total: Some(asset.size),
            done: true,
        },
    );

    let _ = version::write(
        &data_dir,
        kind,
        &InstalledMeta {
            tag: release.tag.clone(),
            jar_name: asset.name.clone(),
        },
    )
    .await;

    let executable =
        config::native_current_dir(&data_dir, kind).join(config::native_executable_name());
    Ok(executable.display().to_string())
}

async fn download_single_file_release(
    app: &AppHandle,
    kind: ServiceKind,
    release: &ReleaseInfo,
) -> AppResult<String> {
    let data_dir = app_data_dir(app)?;
    let asset = release.package_asset.clone().ok_or_else(|| {
        let suffix = config::native_single_file_suffix().unwrap_or("<desteklenmeyen-platform>");
        AppError::Invalid(format!(
            "Release içinde bu platforma uygun single-file binary bulunamadı ({suffix})"
        ))
    })?;

    let binary_path = config::single_file_binary_path(&data_dir, kind);
    let part_path = binary_path.with_extension("part");

    let app_handle = app.clone();
    github::download_asset(&asset, &part_path, move |downloaded, total| {
        let _ = app_handle.emit(
            EVENT_DOWNLOAD_PROGRESS,
            DownloadProgress {
                kind,
                downloaded,
                total,
                done: total.map(|t| downloaded >= t).unwrap_or(false),
            },
        );
    })
    .await?;

    // Unix: çalıştırılabilir yap.
    let part_for_chmod = part_path.clone();
    tokio::task::spawn_blocking(move || -> AppResult<()> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&part_for_chmod, std::fs::Permissions::from_mode(0o755))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| AppError::Invalid(e.to_string()))??;

    // Eski NativePackage kurulumu (current/ dizini) varsa temizle.
    let old_current = config::native_current_dir(&data_dir, kind);
    if old_current.exists() {
        let _ = tokio::fs::remove_dir_all(&old_current).await;
    }

    // Eski binary varsa sil.
    if binary_path.exists() {
        let _ = tokio::fs::remove_file(&binary_path).await;
    }

    // .part → son haline taşı.
    tokio::fs::rename(&part_path, &binary_path).await?;

    let _ = version::write(
        &data_dir,
        kind,
        &InstalledMeta {
            tag: release.tag.clone(),
            jar_name: asset.name.clone(),
        },
    )
    .await;

    let _ = app.emit(
        EVENT_DOWNLOAD_PROGRESS,
        DownloadProgress {
            kind,
            downloaded: asset.size,
            total: Some(asset.size),
            done: true,
        },
    );

    Ok(binary_path.display().to_string())
}

fn extract_archive(archive_path: &Path, dest: &Path, asset_name: &str) -> AppResult<()> {
    if asset_name.ends_with(".zip") {
        extract_zip(archive_path, dest)
    } else if asset_name.ends_with(".tar.gz") {
        extract_tar_gz(archive_path, dest)
    } else {
        Err(AppError::Invalid(format!(
            "Desteklenmeyen servis paketi arşivi: {asset_name}"
        )))
    }
}

fn extract_tar_gz(archive_path: &Path, dest: &Path) -> AppResult<()> {
    let file = std::fs::File::open(archive_path)?;
    let decoder = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    archive
        .unpack(dest)
        .map_err(|e| AppError::Invalid(e.to_string()))
}

fn extract_zip(archive_path: &Path, dest: &Path) -> AppResult<()> {
    let file = std::fs::File::open(archive_path)?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| AppError::Invalid(e.to_string()))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| AppError::Invalid(e.to_string()))?;
        let Some(enclosed) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            continue;
        };
        let out_path = dest.join(enclosed);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut out = std::fs::File::create(&out_path)?;
        std::io::copy(&mut entry, &mut out).map_err(|e| AppError::Io(e.to_string()))?;

        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&out_path, std::fs::Permissions::from_mode(mode))?;
        }
    }
    Ok(())
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
        if descriptor
            .jar_prefix()
            .map(|prefix| name.starts_with(prefix))
            .unwrap_or(false)
            && name.ends_with(".jar")
        {
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
    // 1) Tüm servisleri PARALEL olarak en güncel sürüme getir. Her servis
    //    bağımsız bir GitHub kontrolü (+ gerekiyorsa indirme) yapar; sıralı
    //    beklemek yerine eşzamanlı koştuğumuzda açılışta "hazır olma" süresi
    //    servislerin toplamı değil, EN YAVAŞ servis kadar olur. İndirmeler ayrı
    //    dizinlere yazar ve Java servislerinin ensure_latest yolu manager kilidine
    //    dokunmaz (yalnız native güncellemesi kısa süreli kilitler), bu yüzden
    //    eşzamanlı çalışmak güvenlidir.
    let ensure_futures = config::ALL_SERVICES.map(|d| d.kind).map(|kind| {
        let app = app.clone();
        async move {
            match ensure_latest(&app, kind).await {
                // Başarılı (indirildi veya zaten güncel) → varsa eski hatayı temizle.
                Ok(_) => set_setup_error(&app, kind, None).await,
                Err(err) => {
                    tracing::warn!(
                        service = kind.as_str(),
                        error = %err,
                        "otomatik kurulum/güncelleme atlandı"
                    );
                    // Hatayı görünür kıl: kullanıcı neden inmediğini görsün.
                    set_setup_error(&app, kind, Some(err.to_string())).await;
                }
            }
        }
    });
    futures_util::future::join_all(ensure_futures).await;

    // 2) Servisleri "aktif" hale getir. ÖNCELİK OS-SERVİSİ: ilk açılışta her servis
    //    işletim sistemine (LaunchAgent / systemd --user / Scheduled Task) kaydedilir
    //    ve sürekli sıcak kalır; sonraki açılışlarda zaten ayakta bulunur. OS kaydı
    //    başarısızsa child-process'e düşülür (geriye dönük güvence). Sıralı bırakıldı
    //    (her adım kısa: ya is_installed kontrolü ya da tek bir kayıt komutu).
    for kind in config::ALL_SERVICES.map(|d| d.kind) {
        if let Err(err) = ensure_service_active(&app, kind).await {
            tracing::warn!(
                service = kind.as_str(),
                error = %err,
                "servis aktifleştirme atlandı"
            );
        }
    }

    // GİB doğrulama paketleri (şema + şematron) servisin kendisi tarafından
    // otomatik indirilir: XSLT servisi `VALIDATION_ASSETS_GIB_AUTO_SYNC=true`
    // env'i ile başlatıldığından, asset dizini boşsa ApplicationReady'de
    // paketleri arka planda indirir. Bu yüzden burada ek bir işlem gerekmez.
}

/// Servisin yerel artifact'ını en güncel release ile senkron tutar.
/// Zaten güncel ve artifact yerindeyse indirme yapmaz.
/// Dönüş: indirme/güncelleme yapıldıysa `true`.
async fn ensure_latest(app: &AppHandle, kind: ServiceKind) -> AppResult<EnsureLatestOutcome> {
    let descriptor = descriptor_for(kind);

    // GÖMÜLÜ servis: sürüm desktop uygulamasına kilitlidir. GitHub'a/ağa HİÇ
    // dokunmadan "güncel" kabul edilir (kurumsal proxy/çevrimdışı ortamda da
    // sorunsuz). Güncelleme ancak yeni bir desktop sürümüyle (yeni build) gelir.
    if resolve_bundled_artifact(app, &descriptor).is_some() {
        return Ok(EnsureLatestOutcome {
            updated: false,
            start_after_update: false,
        });
    }

    let data_dir = app_data_dir(app)?;
    let release = github::latest_release(&descriptor).await?;

    let artifact_present = resolve_installed_artifact(&data_dir, &descriptor).is_some();
    if artifact_present && version::is_up_to_date(&data_dir, kind, &release.tag) {
        return Ok(EnsureLatestOutcome {
            updated: false,
            start_after_update: false,
        });
    }

    let start_after_update = stop_running_native_for_update(app, &descriptor).await?;
    if let Err(err) = download_release(app, kind, &release).await {
        if start_after_update {
            let _ = launch_service(app, kind).await;
        }
        return Err(err);
    }

    Ok(EnsureLatestOutcome {
        updated: true,
        start_after_update,
    })
}

async fn stop_running_native_for_update(
    app: &AppHandle,
    descriptor: &ServiceDescriptor,
) -> AppResult<bool> {
    if !matches!(
        descriptor.runtime,
        ServiceRuntime::NativePackage { .. } | ServiceRuntime::NativeSingleFile { .. }
    ) {
        return Ok(false);
    }

    let state = app.state::<AppState>();
    let mut manager = state.manager.lock().await;
    if !manager.is_running(descriptor.kind) {
        return Ok(false);
    }
    manager.stop(descriptor.kind)?;
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
        for kind in config::ALL_SERVICES.map(|d| d.kind) {
            match ensure_latest(&app, kind).await {
                Ok(outcome) if outcome.updated => {
                    on_service_updated(&app, kind, outcome.start_after_update).await
                }
                Ok(_) => {}
                Err(err) => tracing::warn!(
                    service = kind.as_str(),
                    error = %err,
                    "arka plan güncelleme kontrolü başarısız"
                ),
            }
        }
    }
}

/// Bir servisin artifact'ı güncellendiğinde çağrılır: çalışıyorsa yeni sürümle
/// yeniden başlatır ve frontend'e `service-updated` event'i yayınlar.
async fn on_service_updated(app: &AppHandle, kind: ServiceKind, start_after_update: bool) {
    let tag = app_data_dir(app)
        .ok()
        .and_then(|dir| version::read(&dir, kind))
        .map(|meta| meta.tag);

    let restarted = restart_after_update(app, kind, start_after_update)
        .await
        .unwrap_or_else(|err| {
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
        "servis artifact'ı güncellendi"
    );
    let _ = app.emit(
        EVENT_SERVICE_UPDATED,
        ServiceUpdatedEvent {
            kind,
            tag,
            restarted,
        },
    );
}

async fn restart_after_update(
    app: &AppHandle,
    kind: ServiceKind,
    start_after_update: bool,
) -> AppResult<bool> {
    if start_after_update {
        launch_service(app, kind).await?;
        return Ok(true);
    }
    restart_if_running(app, kind).await
}

/// Servis bu uygulama tarafından çalışıyorsa durdurup yeni jar ile ilk boş
/// porttan yeniden başlatır. Dönüş: yeniden başlatma yapıldıysa `true`.
/// Çalışmıyorsa hiçbir şey yapmaz (yeni jar bir sonraki başlatmada kullanılır).
async fn restart_if_running(app: &AppHandle, kind: ServiceKind) -> AppResult<bool> {
    {
        let state = app.state::<AppState>();
        let mut manager = state.manager.lock().await;
        if !manager.is_running(kind) {
            return Ok(false);
        }
        manager.stop(kind)?;
    }

    launch_service(app, kind).await?;
    Ok(true)
}

/// Bir servisin başlatma sürecine ait log çıktısını döner.
/// Süreç stdout/stderr çıktısını `launch.log` dosyasına yazar; bu komut
/// dosyanın son `lines` satırını okur. Servis hiç başlatılmamışsa boş döner.
#[tauri::command]
pub async fn read_service_launch_logs(
    app: AppHandle,
    kind: ServiceKind,
    lines: Option<usize>,
) -> AppResult<String> {
    let data_dir = app_data_dir(&app)?;
    let log_path = config::launch_log_path(&data_dir, kind);

    if !log_path.exists() {
        return Ok(String::new());
    }

    let max_lines = lines.unwrap_or(500);
    let content = tokio::task::spawn_blocking(move || -> String {
        let bytes = match std::fs::read(&log_path) {
            Ok(b) => b,
            Err(_) => return String::new(),
        };
        let text = String::from_utf8_lossy(&bytes);
        let all: Vec<&str> = text.lines().collect();
        let skip = all.len().saturating_sub(max_lines);
        all[skip..].join("\n")
    })
    .await
    .unwrap_or_default();

    Ok(content)
}

/// Bir servisi açılışta "aktif" hale getirir. Öncelik OS-servisidir:
///
/// 1. Default port zaten yanıt veriyorsa (dışarıdan veya önceki oturumdaki
///    OS-servisinden) hiçbir şey yapma.
/// 2. OS-servisi kuruluysa (LaunchAgent/systemd/Task) dokunma — OS onu yönetir ve
///    sıcak tutar; kopya child SPAWN ETME.
/// 3. Kurulu değilse OS-servisi olarak kurmayı dene (artifact mevcutsa). Kurulum
///    servisi başlatır → bir daha kalkış maliyeti ödenmez.
/// 4. OS kurulumu başarısızsa (artifact yok, izin yok vb.) child-process olarak
///    başlat — uygulama yine çalışsın (geriye dönük güvence).
async fn ensure_service_active(app: &AppHandle, kind: ServiceKind) -> AppResult<()> {
    let descriptor = descriptor_for(kind);

    // Windows: OS-servis kaydı artık UYGULAMA tarafından (Scheduled Task) DEĞİL,
    // INSTALLER tarafından gerçek bir Windows Service olarak yapılır. Bu yüzden
    // uygulama açılışta hiçbir Scheduled Task kurmaz. Ayrıca v0.1.12'nin otomatik
    // kurduğu, görünür cmd penceresi açıp flaşlayan eski `MerselImzamatik-*`
    // task'larını TEMİZLER (güncellemede kendini iyileştirir). Servis Windows
    // Service olarak (installer) ayaktaysa default port'ta yanıt verir ve aşağıdaki
    // is_reachable onu otomatik kullanır; değilse sessiz child-process'e düşülür.
    #[cfg(windows)]
    {
        let _ = crate::os_service::cleanup_legacy(kind);
        if http::is_reachable(descriptor.default_port).await {
            return Ok(());
        }
        return launch_service(app, kind).await.map(|_| ());
    }

    // 1) OS-servisi zaten kurulu mu? Kuruluysa SÜRÜM SENKRONU + CANLILIK kontrolü.
    #[cfg(not(windows))]
    {
    if crate::os_service::is_installed(kind) {
        if let Ok(data_dir) = app_data_dir(app) {
            let want = current_artifact_tag(app, kind);
            let have = read_os_service_tag(&data_dir, kind);

            // Desktop app güncellendi → gömülü servis sürümü değişti. OS-servisini
            // DÜZGÜNCE durdur (Windows'ta dosya kilidi serbest kalsın), launcher'ı
            // yeni artifact'a repoint et (install üzerine yazar), yeniden başlat.
            if want.is_some() && want != have {
                if let Ok(spec) = build_launch_spec(app, kind).await {
                    let _ = crate::os_service::stop(kind);
                    tokio::time::sleep(Duration::from_millis(600)).await;
                    match crate::os_service::install(kind, &spec) {
                        Ok(()) => {
                            let _ = crate::os_service::start(kind);
                            if let Some(tag) = want.as_deref() {
                                write_os_service_tag(&data_dir, kind, tag);
                            }
                            tracing::info!(
                                service = kind.as_str(),
                                tag = want.as_deref().unwrap_or("?"),
                                "OS-servisi yeni sürüme güncellendi"
                            );
                            return Ok(());
                        }
                        Err(err) => tracing::warn!(
                            service = kind.as_str(),
                            error = %err,
                            "OS-servis sürüm güncellemesi başarısız"
                        ),
                    }
                }
            }
        }

        // Sürüm aynı: kurulu ama henüz yanıt vermiyorsa (durdurulmuş/yeni login)
        // başlatmayı dene — uygulama açıldığında hazır olsun.
        if !http::is_reachable(descriptor.default_port).await {
            let _ = crate::os_service::start(kind);
        }
        return Ok(());
    }

    // 2) Kurulu değil — default portta zaten çalışıyor mu? (dış/elle başlatılmış)
    if http::is_reachable(descriptor.default_port).await {
        return Ok(());
    }

    // 3) OS-servisi olarak kurmayı dene (kurulum servisi başlatır).
    match build_launch_spec(app, kind).await {
        Ok(spec) => match crate::os_service::install(kind, &spec) {
            Ok(()) => {
                if let (Ok(data_dir), Some(tag)) =
                    (app_data_dir(app), current_artifact_tag(app, kind))
                {
                    write_os_service_tag(&data_dir, kind, &tag);
                }
                tracing::info!(service = kind.as_str(), "OS-servisi olarak kuruldu");
                return Ok(());
            }
            Err(err) => tracing::warn!(
                service = kind.as_str(),
                error = %err,
                "OS-servis kurulumu başarısız; child-process'e düşülüyor"
            ),
        },
        Err(err) => tracing::warn!(
            service = kind.as_str(),
            error = %err,
            "OS-servis tarifi üretilemedi; child-process'e düşülüyor"
        ),
    }

    // 4) Geriye dönük güvence: child-process olarak başlat.
    launch_service(app, kind).await?;
    Ok(())
    }
}
