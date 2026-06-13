//! Sistem seviyesi komutlar: Java tespiti, metin dosyası yazma, sürüm notları.

use crate::config;
use crate::download::github;
use crate::error::AppResult;
use crate::java;
use crate::models::{ChangelogEntry, JavaInfo, JavaRuntimeInfo};
use std::collections::BTreeMap;
use tauri::AppHandle;

/// Makinedeki Java runtime'ı tespit eder. Önce uygulamayla paketlenmiş JRE'yi,
/// ardından `JAVA_HOME` / `PATH` üzerindeki Java'yı dener.
#[tauri::command]
pub async fn detect_java(app: AppHandle) -> JavaInfo {
    let jre_dir = config::bundled_jre21_dir(&app);
    tokio::task::spawn_blocking(move || java::detect(jre_dir))
        .await
        .unwrap_or(JavaInfo {
            available: false,
            executable: None,
            version: None,
            major: None,
            source: None,
            bundled: false,
        })
}

/// Servislerin gerektirdiği **her bir Java sürümü için ayrı** runtime durumunu
/// döner (örn. imza/doğrulama → Java 8, önizleme → Java 21). Her yuva için
/// servise uygun paketli JRE önceliklenir; eşiği karşılayan ilk runtime
/// (paketli → `JAVA_HOME` → `PATH`) raporlanır. Dashboard bu listeyi ayrı ayrı
/// gösterir.
#[tauri::command]
pub async fn detect_java_runtimes(app: AppHandle) -> Vec<JavaRuntimeInfo> {
    // Gerekli major sürümleri, o sürümü kullanan servislerle grupla (artan sırada).
    let mut groups: BTreeMap<u32, Vec<&'static str>> = BTreeMap::new();
    for descriptor in config::ALL_SERVICES {
        if let Some(major) = descriptor.min_java_major() {
            groups
                .entry(major)
                .or_default()
                .push(descriptor.display_name);
        }
    }

    let mut runtimes = Vec::with_capacity(groups.len());
    for (major, services) in groups {
        let preferred = config::bundled_jre_dir_for(&app, major);
        let detected = tokio::task::spawn_blocking(move || {
            java::detect_satisfying(preferred.as_deref(), major)
        })
        .await
        .ok()
        .flatten();

        let purpose = services.join(" · ");
        let label = format!("Java {major}");
        runtimes.push(match detected {
            Some(d) => JavaRuntimeInfo {
                required_major: major,
                label,
                purpose,
                available: true,
                version: d.version,
                major: Some(d.major),
                source: Some(d.source.as_str().to_string()),
                bundled: d.bundled,
            },
            None => JavaRuntimeInfo {
                required_major: major,
                label,
                purpose,
                available: false,
                version: None,
                major: None,
                source: None,
                bundled: false,
            },
        });
    }
    runtimes
}

/// Uygulamanın GitHub deposundaki sürüm notlarını (changelog) en yeniden
/// eskiye listeler. Her girdinin gövdesi GitHub Markdown'ı olarak gelir ve
/// frontend'de render edilir.
#[tauri::command]
pub async fn list_app_releases() -> AppResult<Vec<ChangelogEntry>> {
    github::list_releases(config::APP_REPO_OWNER, config::APP_REPO_NAME, 30).await
}

/// Verilen metni `path`'e UTF-8 olarak yazar (tanılama dışa aktarımı için).
#[tauri::command]
pub async fn write_text_file(path: String, contents: String) -> AppResult<String> {
    tokio::fs::write(&path, contents.as_bytes()).await?;
    Ok(path)
}

/// `from` yolundaki dosyayı `to` yoluna taşır (imza sonrası geçici çıktıyı
/// kullanıcının seçtiği konuma kalıcılaştırmak için). Aynı disk bölümünde
/// hızlı `rename`, farklıysa kopyala+sil yapar. Yazılan nihai yolu döner.
#[tauri::command]
pub async fn persist_file(from: String, to: String) -> AppResult<String> {
    if tokio::fs::rename(&from, &to).await.is_err() {
        tokio::fs::copy(&from, &to).await?;
        let _ = tokio::fs::remove_file(&from).await;
    }
    Ok(to)
}
