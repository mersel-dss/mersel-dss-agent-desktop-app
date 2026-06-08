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
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// `java -version` çağrısının askıda kalmadan beklenecek azami süresi. Bazı
/// platformlarda (örn. Rosetta altındaki x86_64 JRE) `-version` süreci nadiren
/// çıkışta takılabiliyor; bu durumda süreç öldürülür ve sürüm `release`
/// dosyasından okunmaya çalışılır.
const VERSION_PROBE_TIMEOUT: Duration = Duration::from_secs(5);

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
    if run_version_output(exe_name()).is_some() {
        return Some((exe_name().to_string(), JavaSource::Path));
    }
    None
}

/// Bir java çalıştırılabilirinin `(tam_sürüm, major)` bilgisini (`java -version`
/// üzerinden) döner. Okunamaz veya zaman aşımına uğrarsa `None`.
fn detect_exe(exe: &str) -> Option<(String, u32)> {
    let text = run_version_output(exe)?;
    let version = parse_version(&text)?;
    let major = parse_major(&version)?;
    Some((version, major))
}

/// `<exe> -version` çıktısını (stderr'e yazılır) en çok `VERSION_PROBE_TIMEOUT`
/// bekleyerek döner. Süre aşılırsa süreç öldürülüp `wait` edilir (zombie/askıda
/// kalan süreç birikmesini önler) ve `None` döner.
fn run_version_output(exe: &str) -> Option<String> {
    let mut child = Command::new(exe)
        .arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if start.elapsed() > VERSION_PROBE_TIMEOUT {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(_) => return None,
        }
    }

    let out = child.wait_with_output().ok()?;
    Some(String::from_utf8_lossy(&out.stderr).into_owned())
}

/// Bir JRE/JDK kök dizinindeki `release` dosyasından `JAVA_VERSION` değerini
/// okur (örn. `JAVA_VERSION="1.8.0_492"` → `1.8.0_492`). Süreç çalıştırmaz;
/// paketli runtime'ın sürümünü askıya almadan, anında belirlemek için.
fn read_release_version(dir: &Path) -> Option<String> {
    let content = std::fs::read_to_string(dir.join("release")).ok()?;
    for line in content.lines() {
        if let Some(rest) = line.strip_prefix("JAVA_VERSION=") {
            let v = rest.trim().trim_matches('"').to_string();
            if !v.is_empty() {
                return Some(v);
            }
        }
    }
    None
}

/// Bir JRE dizininin `(tam_sürüm, major)` bilgisini çözer. Önce `release`
/// dosyasından (exec gerektirmez, askıya almaz), bulunamazsa `bin/java
/// -version` (zaman aşımlı) üzerinden. `bin/java` yoksa `None`.
fn detect_dir(dir: &Path) -> Option<(String, u32)> {
    let console = dir.join("bin").join(exe_name());
    if !console.exists() {
        return None;
    }
    if let Some(version) = read_release_version(dir) {
        if let Some(major) = parse_major(&version) {
            return Some((version, major));
        }
    }
    detect_exe(console.to_str()?)
}

/// Bir java çalıştırılabilirinin major sürümünü döner. Okunamazsa `None`.
fn exe_major(exe: &str) -> Option<u32> {
    detect_exe(exe).map(|(_, major)| major)
}

/// Çözülen (gereksinimi karşılayan) bir Java runtime'ının detayları.
#[derive(Debug, Clone)]
pub struct DetectedJava {
    pub version: Option<String>,
    pub major: u32,
    pub source: JavaSource,
    pub bundled: bool,
}

/// Verilen minimum major sürümünü **karşılayan** ilk runtime'ı tespit eder.
/// Sıra: tercih edilen paketli JRE → `JAVA_HOME` → `PATH`. Eşiği karşılayan
/// ilk runtime'ın detayını döner; hiçbiri karşılamazsa `None`.
pub fn detect_satisfying(preferred: Option<&Path>, min_major: u32) -> Option<DetectedJava> {
    // 1. Tercih edilen paketli JRE (sürüm `release` dosyasından — askıya almaz).
    if let Some(dir) = preferred {
        if let Some((version, major)) = detect_dir(dir) {
            if major >= min_major {
                return Some(DetectedJava {
                    version: Some(version),
                    major,
                    source: JavaSource::Bundled,
                    bundled: true,
                });
            }
        }
    }
    // 2. JAVA_HOME.
    if let Ok(home) = std::env::var("JAVA_HOME") {
        if let Some((version, major)) = detect_dir(Path::new(&home)) {
            if major >= min_major {
                return Some(DetectedJava {
                    version: Some(version),
                    major,
                    source: JavaSource::JavaHome,
                    bundled: false,
                });
            }
        }
    }
    // 3. PATH (zaman aşımlı `java -version`).
    if let Some((version, major)) = detect_exe(exe_name()) {
        if major >= min_major {
            return Some(DetectedJava {
                version: Some(version),
                major,
                source: JavaSource::Path,
                bundled: false,
            });
        }
    }
    None
}

/// Bir JRE dizini için `(console_exe, launcher_exe)` çiftini döner (varsa).
/// `console_exe` sürüm tespiti için (`java`), `launcher_exe` daemon başlatmak
/// için (Windows'ta konsolsuz `javaw`, yoksa `java`).
fn dir_java_pair(dir: &Path) -> Option<(String, String)> {
    let console = dir.join("bin").join(exe_name());
    if !console.exists() {
        return None;
    }
    let console_s = console.to_str()?.to_string();
    let launcher = if cfg!(windows) {
        let javaw = dir.join("bin").join("javaw.exe");
        match javaw.exists() {
            true => javaw.to_str()?.to_string(),
            false => console_s.clone(),
        }
    } else {
        console_s.clone()
    };
    Some((console_s, launcher))
}

/// Bir servis için **minimum major sürümü karşılayan** daemon launcher'ını çözer.
///
/// `preferred`: bu servis için tercih edilen paketli JRE dizini (varsa).
/// Aday sırası: paketli JRE → `JAVA_HOME` → `PATH`. `min_major`'dan düşük sürümler
/// elenir. Konsolsuz başlatma için (Windows) `javaw` tercih edilir ama sürüm
/// daima konsol `java` üzerinden tespit edilir. Hiçbir aday eşiği karşılamazsa
/// `None` döner.
pub fn resolve_service_launcher(preferred: Option<&Path>, min_major: u32) -> Option<String> {
    // Aday JRE dizinleri (sırayla).
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(dir) = preferred {
        dirs.push(dir.to_path_buf());
    }
    if let Ok(home) = std::env::var("JAVA_HOME") {
        dirs.push(PathBuf::from(home));
    }

    for dir in &dirs {
        if let Some((console, launcher)) = dir_java_pair(dir) {
            // 1) Hızlı sürüm ön-kontrolü: `release` dosyasından (exec gerektirmez).
            //    Eşiği karşılamayan runtime'lar boşuna çalıştırılmadan elenir.
            if !detect_dir(dir).map(|(_, m)| m >= min_major).unwrap_or(false) {
                continue;
            }
            // 2) Gerçek çalıştırılabilirlik doğrulaması: `java -version` (zaman
            //    aşımlı) gerçekten başarıyla çalışmalı. Bir runtime'ın yalnızca
            //    `release` dosyasına güvenmek yetmez; Apple Silicon'da paketlenen
            //    x86_64 JRE'ler Rosetta altında askıda kalıp süreçleri öldürülemez
            //    "zombie"lere çevirerek servisleri hiç başlatamayabiliyor. Çalışmayan
            //    runtime burada elenir ve bir sonraki adaya (JAVA_HOME → PATH) düşülür.
            if exe_major(&console).map(|m| m >= min_major).unwrap_or(false) {
                return Some(launcher);
            }
        }
    }

    // PATH üzerindeki Java — sürümü konsol `java` ile yokla, launcher olarak
    // (Windows'ta) `javaw`'ı kullan.
    if exe_major(exe_name()).map(|m| m >= min_major).unwrap_or(false) {
        let launcher = if cfg!(windows) { "javaw.exe" } else { "java" };
        return Some(launcher.to_string());
    }

    None
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

    // Paketli runtime'ın sürümünü önce `release` dosyasından (askıya almadan),
    // bulunamazsa zaman aşımlı `java -version` ile belirle.
    let version = if source == JavaSource::Bundled {
        jre_dir
            .as_deref()
            .and_then(read_release_version)
            .or_else(|| run_version_output(&exe).as_deref().and_then(parse_version))
    } else {
        run_version_output(&exe).as_deref().and_then(parse_version)
    };
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
