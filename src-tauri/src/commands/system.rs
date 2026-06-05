//! Sistem seviyesi komutlar: Java tespiti, metin dosyası yazma.

use crate::config;
use crate::error::AppResult;
use crate::java;
use crate::models::JavaInfo;
use tauri::AppHandle;

/// Makinedeki Java runtime'ı tespit eder. Önce uygulamayla paketlenmiş JRE'yi,
/// ardından `JAVA_HOME` / `PATH` üzerindeki Java'yı dener.
#[tauri::command]
pub async fn detect_java(app: AppHandle) -> JavaInfo {
    let jre_dir = config::bundled_jre_dir(&app);
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
