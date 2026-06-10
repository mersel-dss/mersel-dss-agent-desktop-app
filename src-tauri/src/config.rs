//! Servis tanımları (descriptor) ve uygulama dosya yolları.
//! Her yönetilen Java servisi sabit bir descriptor ile tanımlanır.

use crate::models::ServiceKind;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Masaüstü uygulamasının kendi GitHub deposu (sürüm notları / changelog
/// buradan okunur). Updater endpoint'i de aynı depoya işaret eder.
pub const APP_REPO_OWNER: &str = "mersel-dss";
pub const APP_REPO_NAME: &str = "mersel-dss-agent-desktop-app";

/// Bir yönetilen servisin çalışma biçimi.
#[derive(Debug, Clone, Copy)]
pub enum ServiceRuntime {
    Java {
        /// Release asset adının başlangıcı, örn. "mersel-dss-agent-signer-api".
        jar_prefix: &'static str,
        /// Servisin çalışması için gereken minimum Java major sürümü.
        min_java_major: u32,
    },
    NativePackage {
        /// Release asset adının başlangıcı, örn. "MERSEL.Services.HtmlToPdf.Web".
        package_prefix: &'static str,
    },
    NativeSingleFile {
        /// Release asset adının başlangıcı, örn. "MERSEL.Services.HtmlToPdf.Web".
        binary_prefix: &'static str,
    },
}

/// Bir yönetilen servisin statik tanımı.
#[derive(Debug, Clone)]
pub struct ServiceDescriptor {
    pub kind: ServiceKind,
    pub display_name: &'static str,
    pub repo_owner: &'static str,
    pub repo_name: &'static str,
    /// Varsayılan dinleme portu.
    pub default_port: u16,
    pub runtime: ServiceRuntime,
}

impl ServiceDescriptor {
    pub fn jar_prefix(&self) -> Option<&'static str> {
        match self.runtime {
            ServiceRuntime::Java { jar_prefix, .. } => Some(jar_prefix),
            ServiceRuntime::NativePackage { .. } | ServiceRuntime::NativeSingleFile { .. } => None,
        }
    }

    pub fn min_java_major(&self) -> Option<u32> {
        match self.runtime {
            ServiceRuntime::Java { min_java_major, .. } => Some(min_java_major),
            ServiceRuntime::NativePackage { .. } | ServiceRuntime::NativeSingleFile { .. } => None,
        }
    }

    pub fn package_prefix(&self) -> Option<&'static str> {
        match self.runtime {
            ServiceRuntime::Java { .. } => None,
            ServiceRuntime::NativePackage { package_prefix } => Some(package_prefix),
            ServiceRuntime::NativeSingleFile { binary_prefix } => Some(binary_prefix),
        }
    }
}

pub const AGENT: ServiceDescriptor = ServiceDescriptor {
    kind: ServiceKind::Agent,
    display_name: "İmzalama Servisi",
    repo_owner: "mersel-dss",
    repo_name: "mersel-dss-agent-signer-java",
    default_port: 15212,
    runtime: ServiceRuntime::Java {
        jar_prefix: "mersel-dss-agent-signer-api",
        min_java_major: 8,
    },
};

pub const VERIFIER: ServiceDescriptor = ServiceDescriptor {
    kind: ServiceKind::Verifier,
    display_name: "Doğrulama Servisi",
    repo_owner: "mersel-dss",
    repo_name: "mersel-dss-verifier-api-java",
    // Release asset adı "mersel-dss-verify-api-<sürüm>.jar" (verify, verifier değil).
    default_port: 8086,
    runtime: ServiceRuntime::Java {
        jar_prefix: "mersel-dss-verify-api",
        min_java_major: 8,
    },
};

pub const XSLT: ServiceDescriptor = ServiceDescriptor {
    kind: ServiceKind::Xslt,
    display_name: "Önizleme Servisi",
    // Not: Diğer servislerin aksine bu depo `mersel-os` organizasyonundadır.
    repo_owner: "mersel-os",
    repo_name: "ebelge-xslt-service",
    // Release asset adı "mersel-xslt-service-<sürüm>.jar".
    default_port: 8080,
    // Spring Boot 3.4 + Saxon HE 12 → Java 21 (LTS).
    runtime: ServiceRuntime::Java {
        jar_prefix: "mersel-xslt-service",
        min_java_major: 21,
    },
};

pub const HTML_TO_PDF: ServiceDescriptor = ServiceDescriptor {
    kind: ServiceKind::HtmlToPdf,
    display_name: "PDF Dönüştürme Servisi",
    repo_owner: "mersel-os",
    repo_name: "html-to-pdf",
    // Release asset adı "MERSEL.Services.HtmlToPdf.Web-<sürüm>-<rid>.<ext>".
    default_port: 5090,
    runtime: ServiceRuntime::NativePackage {
        package_prefix: "MERSEL.Services.HtmlToPdf.Web",
    },
};

pub const ALL_SERVICES: [ServiceDescriptor; 4] = [AGENT, VERIFIER, XSLT, HTML_TO_PDF];

pub fn descriptor_for(kind: ServiceKind) -> ServiceDescriptor {
    match kind {
        ServiceKind::Agent => AGENT,
        ServiceKind::Verifier => VERIFIER,
        ServiceKind::Xslt => XSLT,
        ServiceKind::HtmlToPdf => HTML_TO_PDF,
    }
}

/// Belirli bir servisin jar dosyalarının saklandığı dizin.
pub fn jars_dir(app_data_dir: &Path, kind: ServiceKind) -> PathBuf {
    app_data_dir.join("services").join(kind.as_str())
}

/// Bir servisin GÖMÜLÜ (paketlenmiş, build-time'da `pnpm fetch-services` ile
/// yerleştirilmiş) artifact dizini: `<resource_dir>/services/<kind>`. Dizin
/// yoksa `None` (servis gömülmemiş → çağıran runtime-indirme yoluna düşer).
///
/// Gömülü artifact'lar SALT-OKUNUR'dur (paket içinde); bu yüzden çalıştırırken
/// çalışma dizini (cwd) ayrıca yazılabilir bir dizine (`jars_dir`) sabitlenir.
pub fn bundled_service_dir(app: &AppHandle, kind: ServiceKind) -> Option<PathBuf> {
    let dir = app.path().resource_dir().ok()?.join("services").join(kind.as_str());
    dir.exists().then_some(dir)
}

/// Native paketli servislerin aktif kurulum dizini.
pub fn native_current_dir(app_data_dir: &Path, kind: ServiceKind) -> PathBuf {
    jars_dir(app_data_dir, kind).join("current")
}

/// Native paketli servis executable adı.
pub fn native_executable_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "Web.exe"
    } else {
        "Web"
    }
}

/// Mevcut işletim sistemi/mimari için beklenen release asset son eki.
pub fn native_package_suffix() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Some("-win-x64.zip"),
        ("macos", "x86_64") => Some("-osx-x64.tar.gz"),
        ("macos", "aarch64") => Some("-osx-arm64.tar.gz"),
        ("linux", "x86_64") => Some("-linux-x64.tar.gz"),
        _ => None,
    }
}

/// Single-file publish native binary için beklenen release asset son eki.
/// Arşiv değil, ham çalıştırılabilir dosya (Windows: .exe, diğerleri: uzantısız).
pub fn native_single_file_suffix() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Some("-win-x64.exe"),
        ("macos", "x86_64") => Some("-osx-x64"),
        ("macos", "aarch64") => Some("-osx-arm64"),
        ("linux", "x86_64") => Some("-linux-x64"),
        _ => None,
    }
}

/// Single-file native binary'nin hedef dizindeki dosya adı.
pub fn single_file_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "html-to-pdf.exe"
    } else {
        "html-to-pdf"
    }
}

/// Single-file native binary'nin tam yolu.
pub fn single_file_binary_path(app_data_dir: &Path, kind: ServiceKind) -> PathBuf {
    jars_dir(app_data_dir, kind).join(single_file_binary_name())
}

/// Bir servisin kurulu sürüm üst verisini (installed.json) tutan dosya.
pub fn installed_meta_path(app_data_dir: &Path, kind: ServiceKind) -> PathBuf {
    jars_dir(app_data_dir, kind).join("installed.json")
}

/// Bir servisin başlatma sürecinde stdout/stderr çıktısının yazıldığı dosya.
pub fn launch_log_path(app_data_dir: &Path, kind: ServiceKind) -> PathBuf {
    jars_dir(app_data_dir, kind).join("launch.log")
}

/// XSLT servisinin GİB doğrulama asset'lerini (XSD + schematron paketleri)
/// kalıcı sakladığı dizin. Servis bu dizini izler; boşken açılışta GİB'den
/// otomatik indirir, ayrıca açık sync ile en güncel sürüme çekilir.
pub fn xslt_assets_dir(app_data_dir: &Path) -> PathBuf {
    jars_dir(app_data_dir, ServiceKind::Xslt).join("assets")
}

/// Belirtilen ortam değişkeni override'ını ya da `<resource_dir>/<subdir>`
/// altındaki paketlenmiş JRE kök dizinini çözer. Dizin (ve `bin/`) yoksa `None`.
fn bundled_jre_in(app: &AppHandle, env_var: &str, subdir: &str) -> Option<PathBuf> {
    if let Ok(path) = std::env::var(env_var) {
        let dir = PathBuf::from(path);
        if dir.join("bin").exists() {
            return Some(dir);
        }
    }
    let resource_dir = app.path().resource_dir().ok()?;
    let dir = resource_dir.join(subdir);
    if dir.join("bin").exists() {
        Some(dir)
    } else {
        None
    }
}

/// Uygulamayla paketlenmiş **Java 8** JRE kök dizinini çözer (imza/doğrulama
/// servisleri için). Override: `MERSEL_JRE_HOME`, paket: `<resource_dir>/jre`.
pub fn bundled_jre_dir(app: &AppHandle) -> Option<PathBuf> {
    bundled_jre_in(app, "MERSEL_JRE_HOME", "jre")
}

/// Uygulamayla paketlenmiş **Java 21** JRE kök dizinini çözer (XSLT önizleme
/// servisi için). Override: `MERSEL_JRE21_HOME`, paket: `<resource_dir>/jre21`.
pub fn bundled_jre21_dir(app: &AppHandle) -> Option<PathBuf> {
    bundled_jre_in(app, "MERSEL_JRE21_HOME", "jre21")
}

/// Verilen minimum Java major sürümünü karşılayabilecek **tercih edilen**
/// paketli JRE dizinini döner: 8'den büyük gereksinimlerde Java 21 paketi,
/// aksi hâlde Java 8 paketi. Paket yoksa `None` (çağıran sistem Java'sına düşer).
pub fn bundled_jre_dir_for(app: &AppHandle, min_java_major: u32) -> Option<PathBuf> {
    if min_java_major > 8 {
        bundled_jre21_dir(app)
    } else {
        bundled_jre_dir(app)
    }
}
