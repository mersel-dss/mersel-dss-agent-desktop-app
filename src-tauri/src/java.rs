//! Java runtime tespiti ve çözümlemesi.
//!
//! Çözümleme önceliği:
//! 1. **Paketlenmiş JRE** — uygulamayla birlikte gelen platforma özel JRE 1.8
//!    (`<resource_dir>/jre`). Sistemde Java kurulu olmasa bile çalışır.
//! 2. `JAVA_HOME` ortam değişkeni.
//! 3. `PATH` üzerindeki `java`.
//!
//! Paketlenmiş JRE dizini normalize edilmiştir: tüm platformlarda doğrudan
//! `bin/` ve `lib/` içerir (macOS'taki `Contents/Home` katmanı düzleştirilir).

use crate::models::JavaInfo;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Java çalıştırılabilirinin kaynağı (teşhis/raporlama için).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JavaSource {
    /// Uygulamayla paketlenmiş gömülü JRE.
    Bundled,
    /// `JAVA_HOME` üzerinden bulundu.
    JavaHome,
    /// `PATH` üzerinden bulundu.
    Path,
}

impl JavaSource {
    pub fn as_str(self) -> &'static str {
        match self {
            JavaSource::Bundled => "bundled",
            JavaSource::JavaHome => "java-home",
            JavaSource::Path => "path",
        }
    }
}

/// Konsol (foreground) işlemleri için java çalıştırılabilirini çözer.
/// `jre_dir`: paketlenmiş JRE kök dizini (varsa).
pub fn resolve_java_executable(jre_dir: Option<&Path>) -> Option<(String, JavaSource)> {
    if let Some(dir) = jre_dir {
        if let Some(exe) = bundled_exe(dir, exe_name()) {
            return Some((exe, JavaSource::Bundled));
        }
    }
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let candidate = Path::new(&java_home).join("bin").join(exe_name());
        if candidate.exists() {
            if let Some(s) = candidate.to_str() {
                return Some((s.to_string(), JavaSource::JavaHome));
            }
        }
    }
    if Command::new(exe_name()).arg("-version").output().is_ok() {
        return Some((exe_name().to_string(), JavaSource::Path));
    }
    None
}

/// Daemon başlatmak için kullanılacak çalıştırılabilir. Windows'ta konsolsuz
/// `javaw.exe` tercih edilir; bulunamazsa `java.exe`'ye düşülür.
pub fn resolve_java_launcher(jre_dir: Option<&Path>) -> Option<String> {
    if cfg!(windows) {
        // 1. Paketlenmiş javaw.
        if let Some(dir) = jre_dir {
            if let Some(exe) = bundled_exe(dir, "javaw.exe") {
                return Some(exe);
            }
        }
        // 2. JAVA_HOME/bin/javaw.exe
        if let Ok(java_home) = std::env::var("JAVA_HOME") {
            let candidate = Path::new(&java_home).join("bin").join("javaw.exe");
            if candidate.exists() {
                return candidate.to_str().map(|s| s.to_string());
            }
        }
        // 3. PATH üzerindeki javaw.
        if Command::new("javaw.exe").arg("-version").output().is_ok() {
            return Some("javaw.exe".to_string());
        }
    }
    // Windows dışında veya javaw yoksa standart java.
    resolve_java_executable(jre_dir).map(|(exe, _)| exe)
}

/// Java'yı tespit eder ve sürüm bilgisini döner.
pub fn detect(jre_dir: Option<PathBuf>) -> JavaInfo {
    let Some((exe, source)) = resolve_java_executable(jre_dir.as_deref()) else {
        return JavaInfo {
            available: false,
            executable: None,
            version: None,
            major: None,
            source: None,
            bundled: false,
        };
    };

    // `java -version` çıktısı stderr'e yazılır.
    let output = Command::new(&exe).arg("-version").output();
    match output {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stderr);
            let version = parse_version(&text);
            let major = version.as_deref().and_then(parse_major);
            JavaInfo {
                available: true,
                executable: Some(exe),
                version,
                major,
                source: Some(source.as_str().to_string()),
                bundled: source == JavaSource::Bundled,
            }
        }
        Err(_) => JavaInfo {
            available: false,
            executable: None,
            version: None,
            major: None,
            source: None,
            bundled: false,
        },
    }
}

/// Paketlenmiş JRE dizininde `bin/<name>` var mı? Varsa tam yolu döner.
fn bundled_exe(jre_dir: &Path, name: &str) -> Option<String> {
    let candidate = jre_dir.join("bin").join(name);
    if candidate.exists() {
        candidate.to_str().map(|s| s.to_string())
    } else {
        None
    }
}

fn exe_name() -> &'static str {
    if cfg!(windows) {
        "java.exe"
    } else {
        "java"
    }
}

/// `java version "1.8.0_392"` -> `1.8.0_392`
fn parse_version(text: &str) -> Option<String> {
    let line = text.lines().next()?;
    let start = line.find('"')?;
    let rest = &line[start + 1..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// `1.8.0_392` -> 8, `17.0.2` -> 17
fn parse_major(version: &str) -> Option<u32> {
    let mut parts = version.split('.');
    let first = parts.next()?;
    if first == "1" {
        parts.next()?.parse().ok()
    } else {
        first
            .split(|c: char| !c.is_ascii_digit())
            .next()?
            .parse()
            .ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_legacy_version() {
        assert_eq!(parse_major("1.8.0_392"), Some(8));
    }

    #[test]
    fn parses_modern_version() {
        assert_eq!(parse_major("17.0.2"), Some(17));
        assert_eq!(parse_major("21"), Some(21));
    }
}
