//! Belge önizlemesini **uygulama içinde** yazdırma ve PDF'e aktarma komutları.
//!
//! Tauri webview'ında (özellikle macOS WKWebView) iframe içinden `window.print()`
//! Apple kısıtı yüzünden sessizce çalışmaz. Bu yüzden dönüştürülmüş HTML, kendi
//! (üst-seviye) bir webview penceresine yüklenir:
//!
//! - **Yazdır**: pencere yüklenince native yazdır paneli açılır. Üst-seviye
//!   pencerede `print()` macOS'ta da çalışır (iframe'in aksine) ve panelde
//!   "PDF olarak kaydet" seçeneği de bulunur. Tüm platformlarda geçerlidir.
//! - **PDF (macOS)**: görünmez bir pencerede `WKWebView.createPDF` (public API)
//!   ile belge tek tıkla PDF'e çevrilip kullanıcının seçtiği dosyaya yazılır;
//!   yazdır iletişimi açılmaz.

use super::running_port;
use crate::error::{AppError, AppResult};
use crate::http::htmltopdf;
use crate::models::ServiceKind;
use crate::state::AppState;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, State, WebviewUrl, WebviewWindowBuilder};

/// Dosya adı gövdesini güvenli hale getirir (yalnızca harf/rakam/`-`/`_`).
fn sanitize_stem(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('-');
    if trimmed.is_empty() {
        "onizleme".to_string()
    } else {
        trimmed.chars().take(80).collect()
    }
}

/// Milisaniye cinsinden monotonik olmayan ama benzersizliğe yeten bir damga.
fn stamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// HTML'i geçici bir `.html` dosyasına yazıp `file://` URL'ini döner.
fn write_temp_html(html: &str, stem: &str) -> AppResult<(std::path::PathBuf, tauri::Url)> {
    let path = std::env::temp_dir().join(format!("{stem}-{}.html", stamp()));
    std::fs::write(&path, html.as_bytes())?;
    let url = tauri::Url::from_file_path(&path)
        .map_err(|_| AppError::Invalid("Geçici dosya yolu URL'e çevrilemedi.".to_string()))?;
    Ok((path, url))
}

async fn export_with_htmltopdf(
    state: &AppState,
    html: &str,
    file_name: &str,
    save_path: &str,
) -> AppResult<String> {
    let port = running_port(state, ServiceKind::HtmlToPdf).await?;
    let stem = sanitize_stem(file_name);
    let pdf =
        htmltopdf::convert_html(port, html.as_bytes().to_vec(), &format!("{stem}.html")).await?;
    tokio::fs::write(save_path, &pdf).await?;
    Ok(save_path.to_string())
}

/// Belgeyi ayrı bir webview penceresinde açıp yükleme bitince native yazdır
/// panelini tetikler. (Tüm platformlar.)
#[tauri::command]
pub async fn print_preview_document(
    app: AppHandle,
    html: String,
    file_name: String,
) -> AppResult<()> {
    let stem = sanitize_stem(&file_name);
    let (_path, url) = write_temp_html(&html, &stem)?;
    let label = format!("print-{}", stamp());

    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
        .title("Yazdır")
        .inner_size(840.0, 1050.0)
        .on_page_load(|window, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                let _ = window.print();
            }
        })
        .build()
        .map_err(|e| AppError::Invalid(e.to_string()))?;
    Ok(())
}

/// Belgeyi tek tıkla PDF'e aktarır ve `save_path`'e yazar.
///
/// macOS'ta görünmez bir webview + `WKWebView.createPDF` kullanılır. Diğer
/// platformlarda native köprü olmadığından `native_pdf_unsupported` hatası döner;
/// frontend bunu yakalayıp tarayıcı tabanlı çözüme düşer.
#[tauri::command]
pub async fn export_document_pdf(
    app: AppHandle,
    state: State<'_, AppState>,
    html: String,
    file_name: String,
    save_path: String,
) -> AppResult<String> {
    match export_with_htmltopdf(&state, &html, &file_name, &save_path).await {
        Ok(path) => return Ok(path),
        Err(err) => {
            tracing::warn!(error = %err, "HTML-to-PDF servisiyle PDF üretilemedi");
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, html, file_name);
                return Err(AppError::Invalid(format!("native_pdf_unsupported: {err}")));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use block2::RcBlock;
        use objc2_foundation::{NSData, NSError};
        use objc2_web_kit::WKWebView;
        use std::sync::{Arc, Mutex};

        let stem = sanitize_stem(&file_name);
        let (temp_path, url) = write_temp_html(&html, &stem)?;

        let (tx, rx) = tokio::sync::oneshot::channel::<Result<Vec<u8>, String>>();
        let tx = Arc::new(Mutex::new(Some(tx)));

        let label = format!("pdf-{}", stamp());
        let tx_load = tx.clone();
        let window = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
            .visible(false)
            .on_page_load(move |window, payload| {
                if !matches!(payload.event(), PageLoadEvent::Finished) {
                    return;
                }
                // Bu yükleme için göndericiyi al; tekrar tetiklenirse tekrar üretmeyiz.
                let Some(sender) = tx_load.lock().unwrap().take() else {
                    return;
                };
                let sender = Arc::new(Mutex::new(Some(sender)));
                let _ = window.with_webview(move |platform_webview| {
                    // Bu kapanış ana iş parçacığında çalışır (WKWebView gereği).
                    let sender_cb = sender.clone();
                    let block = RcBlock::new(move |data: *mut NSData, err: *mut NSError| {
                        let result = unsafe {
                            if !data.is_null() {
                                Ok((*data).to_vec())
                            } else if !err.is_null() {
                                Err((*err).localizedDescription().to_string())
                            } else {
                                Err("PDF verisi üretilemedi.".to_string())
                            }
                        };
                        if let Some(tx) = sender_cb.lock().unwrap().take() {
                            let _ = tx.send(result);
                        }
                    });
                    unsafe {
                        let webview: &WKWebView = &*platform_webview.inner().cast();
                        webview.createPDFWithConfiguration_completionHandler(None, &block);
                    }
                });
            })
            .build()
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        let outcome = rx.await;
        let _ = window.close();
        let _ = std::fs::remove_file(&temp_path);

        let bytes = match outcome {
            Ok(Ok(bytes)) => bytes,
            Ok(Err(message)) => return Err(AppError::Invalid(message)),
            Err(_) => return Err(AppError::Invalid("PDF üretimi tamamlanamadı.".to_string())),
        };

        tokio::fs::write(&save_path, &bytes).await?;
        Ok(save_path)
    }

    #[cfg(not(target_os = "macos"))]
    {
        unreachable!("non-macOS PDF export either succeeds via HTML-to-PDF or returns above")
    }
}
