//! Servisleri İŞLETİM SİSTEMİNE kayıtlı, login'de otomatik kalkan ve sürekli
//! ayakta kalan birimler olarak kuran/kaldıran soyutlama. Amaç: uygulama her
//! açıldığında servislerin SOĞUK kalkışını beklememek — servisler arka planda
//! zaten sıcak ve sabit default portta hazır olur; uygulamanın mevcut "dışarıdan
//! çalışıyor" tespiti (`is_reachable(default_port)`) onları otomatik kullanır.
//!
//! Platform mekanizmaları:
//!   • macOS  → LaunchAgent  (KULLANICI kapsamı; `~/Library/LaunchAgents/...`, `launchctl`)
//!   • Linux  → systemd user (KULLANICI kapsamı; `~/.config/systemd/user/...`, `systemctl --user`)
//!   • Windows→ GERÇEK Windows Service (WinSW ile, services.msc'de görünür, Session 0).
//!             Bu uygulama TARAFINDAN DEĞİL, INSTALLER (NSIS, admin/UAC) tarafından
//!             kaydedilir; uygulama yalnız algılar (`sc query`) ve best-effort
//!             start/stop dener. Eski (v0.1.12) Scheduled Task'ları `cleanup_legacy`
//!             temizler. Ayrıntı: `resources/win-service/register.ps1`.
//!
//! macOS/Linux interaktif/kullanıcı oturumunda koştuğu için akıllı kart/PKCS#11
//! doğal görünür; Windows Service Session 0'da koşar (kart erişimi orada da çalışır).
//!
//! Ortam değişkenleri (XSLT asset sync, agent UI bayrakları, ASPNETCORE_URLS)
//! ve çalışma dizini, tüm platformlarda servisin çağırdığı bir LAUNCHER SCRIPT'e
//! (`run.sh` / `run.bat`) yazılır; böylece env aktarımı her mekanizmada tutarlıdır
//! (özellikle schtasks'ın env taşıyamama kısıtı bu sayede aşılır).

use crate::commands::services::LaunchSpec;
use crate::error::{AppError, AppResult};
use crate::models::ServiceKind;
use std::path::PathBuf;
use std::process::Command;

/// Bir servisin OS kaydı için kısa kimliği (kebab-case, `ServiceKind.as_str()`).
fn id(kind: ServiceKind) -> &'static str {
    kind.as_str()
}

/// `Command` üreticisi — Windows'ta GUI sürecinden konsol aracı (schtasks/sc/net)
/// çağrılınca bir an siyah cmd penceresi flaşlamasın diye CREATE_NO_WINDOW ekler.
fn command(program: &str) -> Command {
    let cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut cmd = cmd;
        cmd.creation_flags(CREATE_NO_WINDOW);
        return cmd;
    }
    #[cfg(not(windows))]
    cmd
}

/// Tek bir komutu çalıştırır; çıkış kodu 0 değilse stderr ile hata döner.
fn run(program: &str, args: &[&str]) -> AppResult<()> {
    let output = command(program)
        .args(args)
        .output()
        .map_err(|e| AppError::ServiceStart(format!("{program} çalıştırılamadı: {e}")))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(AppError::ServiceStart(format!(
        "{program} başarısız (kod {:?}): {}",
        output.status.code(),
        stderr.trim()
    )))
}

/// POSIX shell için güvenli tek-tırnak kaçışı (`'` → `'\''`).
#[cfg(not(windows))]
fn sh_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Servisin başlatma tarifini, env + cwd dahil, platforma uygun bir launcher
/// script'ine yazar ve script yolunu döner. Script `spec.work_dir` (yazılabilir)
/// içine konur. (Windows'ta artık kullanılmaz — servisi installer kaydeder.)
#[cfg_attr(windows, allow(dead_code))]
fn write_launcher(spec: &LaunchSpec) -> AppResult<PathBuf> {
    std::fs::create_dir_all(&spec.work_dir)
        .map_err(|e| AppError::Io(e.to_string()))?;

    #[cfg(windows)]
    {
        let path = spec.work_dir.join("run.bat");
        let mut s = String::from("@echo off\r\n");
        s.push_str(&format!("cd /d \"{}\"\r\n", spec.work_dir.display()));
        for (k, v) in &spec.envs {
            s.push_str(&format!("set \"{k}={v}\"\r\n"));
        }
        s.push_str(&format!("\"{}\"", spec.program));
        for a in &spec.args {
            s.push_str(&format!(" \"{a}\""));
        }
        s.push_str("\r\n");
        std::fs::write(&path, s).map_err(|e| AppError::Io(e.to_string()))?;
        Ok(path)
    }

    #[cfg(not(windows))]
    {
        let path = spec.work_dir.join("run.sh");
        let mut s = String::from("#!/bin/sh\n");
        s.push_str(&format!("cd {}\n", sh_quote(&spec.work_dir.display().to_string())));
        for (k, v) in &spec.envs {
            s.push_str(&format!("export {k}={}\n", sh_quote(v)));
        }
        s.push_str(&format!("exec {}", sh_quote(&spec.program)));
        for a in &spec.args {
            s.push(' ');
            s.push_str(&sh_quote(a));
        }
        s.push('\n');
        std::fs::write(&path, &s).map_err(|e| AppError::Io(e.to_string()))?;
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| AppError::Io(e.to_string()))?;
        Ok(path)
    }
}

// ───────────────────────────────── macOS ─────────────────────────────────
#[cfg(target_os = "macos")]
mod imp {
    use super::*;

    fn home() -> AppResult<PathBuf> {
        std::env::var("HOME")
            .map(PathBuf::from)
            .map_err(|_| AppError::Io("HOME tanımlı değil".into()))
    }

    fn label(kind: ServiceKind) -> String {
        format!("io.mersel.dss.{}", id(kind))
    }

    fn plist_path(kind: ServiceKind) -> AppResult<PathBuf> {
        Ok(home()?
            .join("Library")
            .join("LaunchAgents")
            .join(format!("{}.plist", label(kind))))
    }

    pub fn install(kind: ServiceKind, spec: &LaunchSpec) -> AppResult<()> {
        let script = write_launcher(spec)?;
        let plist = plist_path(kind)?;
        if let Some(dir) = plist.parent() {
            std::fs::create_dir_all(dir).map_err(|e| AppError::Io(e.to_string()))?;
        }
        let log = spec.work_dir.join("service-os.log");
        let content = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
<plist version=\"1.0\">\n<dict>\n\
  <key>Label</key><string>{label}</string>\n\
  <key>ProgramArguments</key>\n  <array>\n    <string>/bin/sh</string>\n    <string>{script}</string>\n  </array>\n\
  <key>RunAtLoad</key><true/>\n\
  <key>KeepAlive</key><true/>\n\
  <key>StandardOutPath</key><string>{log}</string>\n\
  <key>StandardErrorPath</key><string>{log}</string>\n\
</dict>\n</plist>\n",
            label = label(kind),
            script = script.display(),
            log = log.display(),
        );
        std::fs::write(&plist, content).map_err(|e| AppError::Io(e.to_string()))?;

        let p = plist.display().to_string();
        let _ = run("launchctl", &["unload", &p]); // varsa eskisini boşalt
        run("launchctl", &["load", "-w", &p])
    }

    pub fn uninstall(kind: ServiceKind) -> AppResult<()> {
        let plist = plist_path(kind)?;
        if plist.exists() {
            let p = plist.display().to_string();
            let _ = run("launchctl", &["unload", "-w", &p]);
            std::fs::remove_file(&plist).map_err(|e| AppError::Io(e.to_string()))?;
        }
        Ok(())
    }

    pub fn is_installed(kind: ServiceKind) -> bool {
        plist_path(kind).map(|p| p.exists()).unwrap_or(false)
    }

    pub fn stop(kind: ServiceKind) -> AppResult<()> {
        let plist = plist_path(kind)?;
        if plist.exists() {
            let _ = run("launchctl", &["unload", &plist.display().to_string()]);
        }
        Ok(())
    }

    pub fn start(kind: ServiceKind) -> AppResult<()> {
        let plist = plist_path(kind)?;
        run("launchctl", &["load", "-w", &plist.display().to_string()])
    }

    pub fn restart(kind: ServiceKind) -> AppResult<()> {
        let _ = stop(kind);
        start(kind)
    }
}

// ───────────────────────────────── Linux ─────────────────────────────────
#[cfg(target_os = "linux")]
mod imp {
    use super::*;

    fn home() -> AppResult<PathBuf> {
        std::env::var("HOME")
            .map(PathBuf::from)
            .map_err(|_| AppError::Io("HOME tanımlı değil".into()))
    }

    fn unit_name(kind: ServiceKind) -> String {
        format!("mersel-{}.service", id(kind))
    }

    fn unit_path(kind: ServiceKind) -> AppResult<PathBuf> {
        Ok(home()?
            .join(".config")
            .join("systemd")
            .join("user")
            .join(unit_name(kind)))
    }

    pub fn install(kind: ServiceKind, spec: &LaunchSpec) -> AppResult<()> {
        let script = write_launcher(spec)?;
        let unit = unit_path(kind)?;
        if let Some(dir) = unit.parent() {
            std::fs::create_dir_all(dir).map_err(|e| AppError::Io(e.to_string()))?;
        }
        let content = format!(
            "[Unit]\nDescription=Mersel İmzamatik servisi ({id})\nAfter=network.target\n\n\
[Service]\nType=simple\nExecStart=/bin/sh {script}\nRestart=always\nRestartSec=2\n\n\
[Install]\nWantedBy=default.target\n",
            id = id(kind),
            script = script.display(),
        );
        std::fs::write(&unit, content).map_err(|e| AppError::Io(e.to_string()))?;

        let name = unit_name(kind);
        let _ = run("systemctl", &["--user", "daemon-reload"]);
        run("systemctl", &["--user", "enable", "--now", &name])
    }

    pub fn uninstall(kind: ServiceKind) -> AppResult<()> {
        let name = unit_name(kind);
        let _ = run("systemctl", &["--user", "disable", "--now", &name]);
        let unit = unit_path(kind)?;
        if unit.exists() {
            std::fs::remove_file(&unit).map_err(|e| AppError::Io(e.to_string()))?;
        }
        let _ = run("systemctl", &["--user", "daemon-reload"]);
        Ok(())
    }

    pub fn is_installed(kind: ServiceKind) -> bool {
        unit_path(kind).map(|p| p.exists()).unwrap_or(false)
    }

    pub fn stop(kind: ServiceKind) -> AppResult<()> {
        let _ = run("systemctl", &["--user", "stop", &unit_name(kind)]);
        Ok(())
    }

    pub fn start(kind: ServiceKind) -> AppResult<()> {
        run("systemctl", &["--user", "start", &unit_name(kind)])
    }

    pub fn restart(kind: ServiceKind) -> AppResult<()> {
        run("systemctl", &["--user", "restart", &unit_name(kind)])
    }
}

// ──────────────────────────────── Windows ────────────────────────────────
//
// Windows'ta servisler GERÇEK Windows Service'leridir (services.msc'de görünür,
// Session 0'da gizli koşar, çökerse OS yeniden başlatır) ve UYGULAMA TARAFINDAN
// DEĞİL, INSTALLER (NSIS, admin/UAC) tarafından WinSW ile kaydedilir. Bu yüzden
// `install`/`uninstall` uygulama içinden çağrılamaz; uygulama yalnızca servisi
// algılar (`is_installed`) ve start/stop'u (mümkünse) dener. Servis kontrolü
// admin gerektirdiğinden start/stop best-effort'tur; servis zaten otomatik
// başlatılmaya ve çökünce yeniden kalkmaya yapılandırılmıştır.
#[cfg(target_os = "windows")]
mod imp {
    use super::*;

    /// WinSW servis kimliği (installer ile aynı olmalı). services.msc'de bu adla
    /// görünür: `MerselImzamatik-agent` vb.
    pub(super) fn service_id(kind: ServiceKind) -> String {
        format!("MerselImzamatik-{}", id(kind))
    }

    /// v0.1.12'nin otomatik kurduğu, görünür cmd penceresi flaşlatan eski
    /// Scheduled Task adı.
    fn legacy_task_name(kind: ServiceKind) -> String {
        format!("MerselImzamatik-{}", id(kind))
    }

    pub fn install(_kind: ServiceKind, _spec: &LaunchSpec) -> AppResult<()> {
        Err(AppError::Invalid(
            "Windows'ta servisler kurulum sırasında (installer) kaydedilir; \
             uygulama içinden kurulamaz."
                .into(),
        ))
    }

    pub fn uninstall(_kind: ServiceKind) -> AppResult<()> {
        // Servis kaldırma installer'ın (uninstaller) işidir; uygulama dokunmaz.
        Ok(())
    }

    pub fn is_installed(kind: ServiceKind) -> bool {
        // `sc query <id>` servis varsa 0 döner; yoksa 1060.
        command("sc")
            .args(["query", &service_id(kind)])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    pub fn stop(kind: ServiceKind) -> AppResult<()> {
        // Best-effort (admin gerektirir). Hata yutulur — installer servisi zaten
        // otomatik yönetir.
        let _ = run("net", &["stop", &service_id(kind)]);
        Ok(())
    }

    pub fn start(kind: ServiceKind) -> AppResult<()> {
        let _ = run("net", &["start", &service_id(kind)]);
        Ok(())
    }

    pub fn restart(kind: ServiceKind) -> AppResult<()> {
        let _ = stop(kind);
        let _ = start(kind);
        Ok(())
    }

    /// Eski Scheduled Task'ı (varsa) durdurup siler — sessizce, hata yutularak.
    pub fn cleanup_legacy(kind: ServiceKind) -> AppResult<()> {
        let name = legacy_task_name(kind);
        let _ = run("schtasks", &["/End", "/TN", &name]);
        let _ = run("schtasks", &["/Delete", "/TN", &name, "/F"]);
        Ok(())
    }
}

// Desteklenmeyen platformlar için no-op (derleme güvenliği).
#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
mod imp {
    use super::*;
    pub fn install(_kind: ServiceKind, _spec: &LaunchSpec) -> AppResult<()> {
        Err(AppError::Invalid("Bu platformda OS-servis desteklenmiyor".into()))
    }
    pub fn uninstall(_kind: ServiceKind) -> AppResult<()> {
        Ok(())
    }
    pub fn is_installed(_kind: ServiceKind) -> bool {
        false
    }
    pub fn stop(_kind: ServiceKind) -> AppResult<()> {
        Ok(())
    }
    pub fn start(_kind: ServiceKind) -> AppResult<()> {
        Ok(())
    }
    pub fn restart(_kind: ServiceKind) -> AppResult<()> {
        Ok(())
    }
}

/// Bir servisi OS-servisi olarak kurar (launcher script + platform kaydı).
pub fn install(kind: ServiceKind, spec: &LaunchSpec) -> AppResult<()> {
    imp::install(kind, spec)
}

/// Bir servisin OS-servis kaydını kaldırır (varsa durdurur).
pub fn uninstall(kind: ServiceKind) -> AppResult<()> {
    imp::uninstall(kind)
}

/// Bir servis OS-servisi olarak kurulu mu?
pub fn is_installed(kind: ServiceKind) -> bool {
    imp::is_installed(kind)
}

/// OS-servisini OS API'siyle DURDURUR (PID kill değil — Windows'ta görev düzgün
/// sonlandırılır, böylece dosya kilitleri serbest kalır).
pub fn stop(kind: ServiceKind) -> AppResult<()> {
    imp::stop(kind)
}

/// OS-servisini OS API'siyle BAŞLATIR.
pub fn start(kind: ServiceKind) -> AppResult<()> {
    imp::start(kind)
}

/// OS-servisini durdurup yeniden başlatır (güncelleme sonrası kullanılır).
pub fn restart(kind: ServiceKind) -> AppResult<()> {
    imp::restart(kind)
}

/// Windows'ta v0.1.12'nin otomatik kurduğu eski `MerselImzamatik-*` Scheduled
/// Task'ını (görünür cmd flaşlatan) temizler. Diğer platformlarda no-op.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn cleanup_legacy(kind: ServiceKind) -> AppResult<()> {
    #[cfg(windows)]
    {
        return imp::cleanup_legacy(kind);
    }
    #[cfg(not(windows))]
    {
        let _ = kind;
        Ok(())
    }
}
