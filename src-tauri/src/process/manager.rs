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

        if let Some(dir) = executable_path.parent() {
            command.current_dir(dir);
            let browsers = dir.join("ms-playwright");
            if browsers.exists() {
                command.env("PLAYWRIGHT_BROWSERS_PATH", browsers);
            }
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
fn fast_start_jvm_args() -> &'static [&'static str] {
    &["-XX:TieredStopAtLevel=1", "-Xshare:auto"]
}

/// Bir servisin jar'dan SONRA eklenecek Spring Boot uygulama argümanlarını döner.
/// Bunlar JVM seçeneği değil program argümanı olduğundan `-jar <jar>`'dan sonra
/// gelmek zorundadır; aksi hâlde JVM "Unrecognized option" verip çöker.
fn application_args(kind: ServiceKind) -> &'static [&'static str] {
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
    // UI bayrakları yalnız agent'ta anlamlı (verifier'da sessizce yok sayılır).
    if kind == ServiceKind::Agent {
        command
            // Spring kalkmadan önceki splash yalnızca env var okur.
            .env("MERSEL_AGENT_UI", "false")
            .env("MERSEL_AGENT_UI_SPLASH", "false");
    }

    // XSLT servisi hem HTML önizleme hem şema (XSD) + şematron doğrulaması yapar.
    // Doğrulama için GİB resmi paketleri (e-Fatura/UBL-TR/e-Arşiv/e-Defter)
    // gerekir; bu asset'leri kalıcı bir dış dizinde tutarız (external-path =
    // sync target-path), böylece bir kez indirilince sonraki açılışlarda
    // diskten okunur.
    //
    // Servisin tüm yapılandırması env ile geçilebilir (bkz. application.yml).
    // Sync'i etkinleştirip "açılışta otomatik sync"i de açıyoruz: servisin kendi
    // GibAutoSyncStartupListener'ı ApplicationReady'de asset dizini boşsa GİB
    // paketlerini arka planda (virtual thread) indirir ve asset registry'yi
    // reload eder. Böylece bizim ek bir admin/token çağrımıza gerek kalmaz;
    // dizin doluysa (sonraki açılışlar) otomatik atlanır.
    if kind == ServiceKind::Xslt {
        if let Some(dir) = assets_dir {
            let dir = dir.display().to_string();
            command
                .env("XSLT_ASSETS_EXTERNAL_PATH", &dir)
                .env("XSLT_ASSETS_WATCH_ENABLED", "true")
                .env("VALIDATION_ASSETS_GIB_SYNC_ENABLED", "true")
                .env("VALIDATION_ASSETS_GIB_AUTO_SYNC", "true")
                .env("VALIDATION_ASSETS_GIB_SYNC_PATH", &dir);
        }
    }
}
