//! Java servis süreçlerinin yaşam döngüsü yöneticisi.
//! Spawn edilen `java -jar ...` process'lerini tutar, başlatır ve durdurur.

use crate::config::ServiceDescriptor;
use crate::error::{AppError, AppResult};
use crate::models::ServiceKind;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Windows'ta alt sürecin konsol penceresi açmasını engeller (CREATE_NO_WINDOW).
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Çalışan tek bir servis süreci.
pub struct RunningService {
    pub child: Child,
    pub port: u16,
    pub jar_path: PathBuf,
}

/// Tüm yönetilen servislerin process tablosu.
#[derive(Default)]
pub struct ServiceManager {
    running: HashMap<ServiceKind, RunningService>,
}

impl ServiceManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Bir servisi tamamen sessiz (headless) modda başlatır. Zaten çalışıyorsa hata döner.
    pub fn start(
        &mut self,
        descriptor: &ServiceDescriptor,
        java_exe: &str,
        jar_path: &Path,
        port: u16,
    ) -> AppResult<u32> {
        if self.is_running(descriptor.kind) {
            return Err(AppError::AlreadyRunning(descriptor.display_name.to_string()));
        }
        if !jar_path.exists() {
            return Err(AppError::JarNotFound(jar_path.display().to_string()));
        }

        let mut command = Command::new(java_exe);
        command.arg("-jar").arg(jar_path).arg(format!("--server.port={port}"));
        configure_silent(&mut command, descriptor.kind);

        command
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .stdin(Stdio::null());

        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);

        let child = command
            .spawn()
            .map_err(|e| AppError::ServiceStart(e.to_string()))?;

        let pid = child.id();
        self.running.insert(
            descriptor.kind,
            RunningService {
                child,
                port,
                jar_path: jar_path.to_path_buf(),
            },
        );
        Ok(pid)
    }

    /// Bir servisi durdurur. Çalışmıyorsa sessizce başarılı sayılır.
    pub fn stop(&mut self, kind: ServiceKind) -> AppResult<()> {
        if let Some(mut svc) = self.running.remove(&kind) {
            let _ = svc.child.kill();
            let _ = svc.child.wait();
        }
        Ok(())
    }

    /// Tüm servisleri durdurur (uygulama kapanışında çağrılır).
    pub fn stop_all(&mut self) {
        let kinds: Vec<ServiceKind> = self.running.keys().copied().collect();
        for kind in kinds {
            let _ = self.stop(kind);
        }
    }

    /// Process tablosunda kayıtlı ve hâlâ ayakta mı?
    /// Beklenmedik şekilde sonlanmış process'leri tablodan temizler.
    pub fn is_running(&mut self, kind: ServiceKind) -> bool {
        let Some(svc) = self.running.get_mut(&kind) else {
            return false;
        };
        match svc.child.try_wait() {
            Ok(Some(_)) => {
                // Süreç sonlanmış.
                self.running.remove(&kind);
                false
            }
            Ok(None) => true,
            Err(_) => true,
        }
    }

    pub fn pid(&self, kind: ServiceKind) -> Option<u32> {
        self.running.get(&kind).map(|s| s.child.id())
    }

    pub fn port(&self, kind: ServiceKind) -> Option<u16> {
        self.running.get(&kind).map(|s| s.port)
    }

    pub fn jar_path(&self, kind: ServiceKind) -> Option<PathBuf> {
        self.running.get(&kind).map(|s| s.jar_path.clone())
    }
}

/// JVM/Spring argümanlarını tamamen sessiz (headless) moda göre yapılandırır.
/// Headless JVM tüm Swing UI'ı (splash + tray + pencere) kapatır; PCSC/PKCS#11
/// kart erişimi AWT kullanmadığından bundan etkilenmez.
fn configure_silent(command: &mut Command, kind: ServiceKind) {
    command.arg("-Djava.awt.headless=true");

    // UI bayrakları yalnız agent'ta anlamlı (verifier'da sessizce yok sayılır).
    if kind == ServiceKind::Agent {
        command
            .arg("--mersel.signer.ui.enabled=false")
            .arg("--mersel.signer.ui.splash-enabled=false")
            .arg("--mersel.signer.ui.tray-enabled=false")
            .arg("--mersel.signer.ui.window-enabled=false")
            // Spring kalkmadan önceki splash yalnızca env var okur.
            .env("MERSEL_AGENT_UI", "false")
            .env("MERSEL_AGENT_UI_SPLASH", "false");
    }
}
