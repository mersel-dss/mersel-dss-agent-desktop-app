//! Yönetilen servis süreçlerinin yaşam döngüsü yöneticisi.
//! Spawn edilen Java jar ve native servis process'lerini tutar, başlatır ve durdurur.

use crate::config::ServiceDescriptor;
use crate::error::{AppError, AppResult};
use crate::models::ServiceKind;
use std::collections::HashMap;
use std::fs::File;
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
    pub artifact_path: PathBuf,
    pub launch_log_path: Option<PathBuf>,
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

    fn prepare_launch_log(path: &Path) -> std::io::Result<File> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        File::create(path)
    }

    /// Bir Java servisini tamamen sessiz (headless) modda başlatır. Zaten çalışıyorsa hata döner.
    /// `launch_log_path` verilirse stdout + stderr bu dosyaya yazılır.
    pub fn start_java(
        &mut self,
        descriptor: &ServiceDescriptor,
        java_exe: &str,
        jar_path: &Path,
        port: u16,
        assets_dir: Option<&Path>,
        launch_log_path: Option<&Path>,
        work_dir: Option<&Path>,
    ) -> AppResult<u32> {
        if self.is_running(descriptor.kind) {
            return Err(AppError::AlreadyRunning(
                descriptor.display_name.to_string(),
            ));
        }
        if !jar_path.exists() {
            return Err(AppError::JarNotFound(jar_path.display().to_string()));
        }

        let mut command = Command::new(java_exe);
        command.arg("-Djava.awt.headless=true");
        // Soğuk başlatmayı kısaltan, tüm HotSpot sürümlerinde güvenli JVM
        // bayrakları (jar'dan ÖNCE — bunlar JVM seçeneği). Servislerin açılış
        // anında en hızlı hazır olması birincil hedef.
        for flag in fast_start_jvm_args() {
            command.arg(flag);
        }
        // Yalnız ortam değişkenlerini (ve gerekiyorsa JVM seçeneklerini) ayarlar;
        // Spring uygulama argümanları jar'dan SONRA eklenir (aşağıya bkz.).
        configure_silent_env(&mut command, descriptor.kind, assets_dir);
        command
            .arg("-jar")
            .arg(jar_path)
            .arg(format!("--server.port={port}"))
            // KRİTİK (Windows): Spring Boot varsayılan olarak 0.0.0.0'a (tüm
            // arayüzler) bağlanır; bu, Windows Defender Firewall'un her servis
            // için "ağ erişimine izin ver?" kutusunu açmasına yol açar. Servise
            // yalnız bu makineden (desktop app) erişildiğinden loopback'e
            // sabitliyoruz: firewall loopback'i filtrelemediği için kutu HİÇ
            // çıkmaz (yönetici izni de gerekmez) ve servis dışarıya açılmaz
            // (daha güvenli). base_url/is_reachable da 127.0.0.1 kullanır.
            .arg("--server.address=127.0.0.1");
        // Spring Boot uygulama argümanları (örn. `--mersel.signer.ui.enabled=false`)
        // mutlaka jar'dan sonra gelmelidir; aksi hâlde JVM bunları kendi seçeneği
        // sanıp "Unrecognized option" ile başlatmayı tümden reddeder.
        for arg in application_args(descriptor.kind) {
            command.arg(arg);
        }

        // KRİTİK: Java sürecinin çalışma dizinini YAZILABİLİR bir klasöre sabitle.
        // Aksi hâlde paketli uygulama Finder/Dock'tan açıldığında alt süreç
        // CWD'sini `/` (kök) olarak miras alır; Spring Boot'un logback
        // yapılandırması göreli `./logs/...` yoluna yazmaya çalışıp
        // "FileNotFoundException: /./logs/application.log" ile başlatmayı tümden
        // reddeder.
        //
        // `work_dir` verilirse o kullanılır — GÖMÜLÜ (salt-okunur paket içi) jar'lar
        // için ZORUNLU: jar'ın bulunduğu `<resource_dir>/services/<kind>` yazılamaz,
        // bu yüzden çağıran cwd'yi yazılabilir `<data_dir>/services/<kind>`'e
        // sabitler. `work_dir` yoksa jar'ın klasörüne (indirilmiş, yazılabilir)
        // düşülür. Her iki durumda da loglar servis başına ayrışır.
        let cwd = work_dir.or_else(|| jar_path.parent());
        if let Some(dir) = cwd {
            let _ = std::fs::create_dir_all(dir);
            command.current_dir(dir);
        }

        if let Some(log) = launch_log_path {
            if let Ok(file) = Self::prepare_launch_log(log) {
                let stderr_file = file.try_clone().unwrap_or_else(|_| {
                    std::fs::File::open(log).unwrap()
                });
                command.stdout(Stdio::from(file));
                command.stderr(Stdio::from(stderr_file));
            } else {
                command.stdout(Stdio::null());
                command.stderr(Stdio::null());
            }
        } else {
            command.stdout(Stdio::null());
            command.stderr(Stdio::null());
        }
        command.stdin(Stdio::null());

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
                artifact_path: jar_path.to_path_buf(),
                launch_log_path: launch_log_path.map(|p| p.to_path_buf()),
            },
        );
        Ok(pid)
    }

    /// Native paketli bir servisi başlatır. Zaten çalışıyorsa hata döner.
    /// `launch_log_path` verilirse stdout + stderr bu dosyaya yazılır.
    pub fn start_native(
        &mut self,
        descriptor: &ServiceDescriptor,
        executable_path: &Path,
        port: u16,
        work_dir: Option<&Path>,
        launch_log_path: Option<&Path>,
    ) -> AppResult<u32> {
        if self.is_running(descriptor.kind) {
            return Err(AppError::AlreadyRunning(
                descriptor.display_name.to_string(),
            ));
        }
        if !executable_path.exists() {
            return Err(AppError::JarNotFound(executable_path.display().to_string()));
        }

        let mut command = Command::new(executable_path);
        command
            .env("ASPNETCORE_URLS", format!("http://127.0.0.1:{port}"))
            .stdin(Stdio::null());

        if let Some(log) = launch_log_path {
            if let Ok(file) = Self::prepare_launch_log(log) {
                let stderr_file = file.try_clone().unwrap_or_else(|_| {
                    std::fs::File::open(log).unwrap()
                });
                command.stdout(Stdio::from(file));
                command.stderr(Stdio::from(stderr_file));
            } else {
                command.stdout(Stdio::null());
                command.stderr(Stdio::null());
            }
        } else {
            command.stdout(Stdio::null());
            command.stderr(Stdio::null());
        }

        // Çalışma dizini: gömülü native salt-okunur paket içinde (.app/.deb) olabilir;
        // bu yüzden YAZILABİLİR bir work_dir verildiyse onu kullan (Windows
        // register.ps1'in ProgramData yaklaşımıyla parite). Verilmezse exe'nin
        // yanını kullan (indirilmiş native için yazılabilir). Playwright Chromium'u
        // bu dizine indirir → PLAYWRIGHT_BROWSERS_PATH daima yazılabilir olmalı.
        if let Some(dir) = work_dir.or_else(|| executable_path.parent()) {
            let _ = std::fs::create_dir_all(dir);
            command.current_dir(dir);
            let browsers = dir.join("ms-playwright");
            let _ = std::fs::create_dir_all(&browsers);
            command.env("PLAYWRIGHT_BROWSERS_PATH", &browsers);
        }

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
                artifact_path: executable_path.to_path_buf(),
                launch_log_path: launch_log_path.map(|p| p.to_path_buf()),
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
        self.running.get(&kind).map(|s| s.artifact_path.clone())
    }

    pub fn launch_log_path(&self, kind: ServiceKind) -> Option<PathBuf> {
        self.running.get(&kind).and_then(|s| s.launch_log_path.clone())
    }
}

/// JVM soğuk başlatmasını kısaltan, tüm HotSpot sürümlerinde (Java 8 ve 21
/// dahil) güvenli ve geri alınabilir bayraklar. `-jar`'dan ÖNCE eklenir.
///
/// - `-XX:TieredStopAtLevel=1`: JIT'i yalnız C1 katmanında tutar → çok daha hızlı
///   kalkış. Uzun ömürlü tepe verimi hafifçe düşer ama bu servisler seyrek,
///   kısa istekler işlediğinden açılış hızı çok daha değerlidir (Spring Boot'un
///   klasik "hızlı başlat" bayrağı).
/// - `-Xshare:auto`: Class Data Sharing arşivi varsa kullan, yoksa sessizce
///   atla → sınıf yükleme hızlanır, hiçbir koşulda başlatmayı engellemez.
pub(crate) fn fast_start_jvm_args() -> &'static [&'static str] {
    &["-XX:TieredStopAtLevel=1", "-Xshare:auto"]
}

/// Bir servisin jar'dan SONRA eklenecek Spring Boot uygulama argümanlarını döner.
/// Bunlar JVM seçeneği değil program argümanı olduğundan `-jar <jar>`'dan sonra
/// gelmek zorundadır; aksi hâlde JVM "Unrecognized option" verip çöker.
pub(crate) fn application_args(kind: ServiceKind) -> &'static [&'static str] {
    match kind {
        // İmza ajanını tamamen sessiz (headless) çalıştır: splash + tray + pencere
        // kapalı. Verifier/XSLT bu bayrakları kullanmadığından boş döner.
        ServiceKind::Agent => &[
            "--mersel.signer.ui.enabled=false",
            "--mersel.signer.ui.splash-enabled=false",
            "--mersel.signer.ui.tray-enabled=false",
            "--mersel.signer.ui.window-enabled=false",
        ],
        _ => &[],
    }
}

/// Servisi tamamen sessiz (headless) çalıştırmak için ORTAM DEĞİŞKENLERİNİ (ve
/// gerekiyorsa JVM seçeneklerini) ayarlar. Headless JVM tüm Swing UI'ı (splash +
/// tray + pencere) kapatır; PCSC/PKCS#11 kart erişimi AWT kullanmadığından bundan
/// etkilenmez. Spring uygulama argümanları için `application_args`'a bakın.
fn configure_silent_env(command: &mut Command, kind: ServiceKind, assets_dir: Option<&Path>) {
    for (key, value) in silent_env_vars(kind, assets_dir) {
        command.env(key, value);
    }
}

/// Bir Java servisini sessiz (headless) çalıştırmak için gereken ORTAM
/// DEĞİŞKENLERİNİ döner. Hem child-process başlatma (`configure_silent_env`) hem
/// de OS-servis kaydı (plist/unit/task) aynı listeyi kullanır → davranış tutarlı.
///
/// - Agent: splash/tray/pencere env bayrakları (Spring kalkmadan okunur).
/// - XSLT: GİB doğrulama asset'lerini kalıcı dış dizinde tutup açılışta otomatik
///   sync eden env'ler (external-path = sync target-path).
pub(crate) fn silent_env_vars(
    kind: ServiceKind,
    assets_dir: Option<&Path>,
) -> Vec<(String, String)> {
    let mut env: Vec<(String, String)> = Vec::new();
    if kind == ServiceKind::Agent {
        env.push(("MERSEL_AGENT_UI".into(), "false".into()));
        env.push(("MERSEL_AGENT_UI_SPLASH".into(), "false".into()));
    }
    if kind == ServiceKind::Xslt {
        if let Some(dir) = assets_dir {
            let dir = dir.display().to_string();
            env.push(("XSLT_ASSETS_EXTERNAL_PATH".into(), dir.clone()));
            env.push(("XSLT_ASSETS_WATCH_ENABLED".into(), "true".into()));
            env.push(("VALIDATION_ASSETS_GIB_SYNC_ENABLED".into(), "true".into()));
            env.push(("VALIDATION_ASSETS_GIB_AUTO_SYNC".into(), "true".into()));
            env.push(("VALIDATION_ASSETS_GIB_SYNC_PATH".into(), dir));
        }
    }
    env
}
