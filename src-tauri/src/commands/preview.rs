//! e-Belge önizleme komutları: XML belgelerini XSLT servisi ile görüntülenebilir
//! HTML'e dönüştürür. Verilen dosya bir e-Belge zarfıysa (StandardBusinessDocument)
//! otomatik tespit edilir ve içindeki **her belge tek tek** önizlenebilir; tekil
//! XML belgesi ise doğrudan dönüştürülür. PDF gibi ikili içerikte önizleme sunulmaz.

use super::running_port;
use crate::envelope;
use crate::error::{AppError, AppResult};
use crate::http::xslt::{self, TransformOutput};
use crate::models::ServiceKind;
use crate::state::AppState;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

/// İçeriğin XML gibi görünüp görünmediğini ucuzca yoklar (ilk boşluk-dışı
/// karakter `<` mı). PDF gibi ikili içeriği gereksiz yere ayrıştırmamak için.
fn looks_like_xml(bytes: &[u8]) -> bool {
    bytes
        .iter()
        .find(|b| !b.is_ascii_whitespace())
        .map(|b| *b == b'<')
        .unwrap_or(false)
}

/// elementType / kök eleman adından XSLT dönüşüm tipini çıkarır. Gömülü XSLT
/// kullanıldığında bu yalnızca varsayılan-şablon yedeği (fallback) için
/// önemlidir; bilinmeyen türlerde `INVOICE`'a düşülür.
fn transform_type_for(element_type: Option<&str>, root_local_name: &str) -> &'static str {
    let raw = element_type.unwrap_or(root_local_name);
    let key: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_uppercase();
    match key.as_str() {
        "INVOICE" => "INVOICE",
        "DESPATCHADVICE" => "DESPATCH_ADVICE",
        "RECEIPTADVICE" => "RECEIPT_ADVICE",
        _ => "INVOICE",
    }
}

/// Dosya adı gövdesini güvenli (yalnızca harf/rakam/`-`/`_`) hale getirir; aksi
/// halde geçici dosya yolunda sorun çıkarabilecek karakterleri `-` ile değiştirir.
fn sanitize_file_stem(name: &str) -> String {
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
        // Aşırı uzun adları kısalt.
        trimmed.chars().take(80).collect()
    }
}

/// Dönüştürülmüş HTML önizlemesini geçici bir dosyaya yazıp sistemin **varsayılan
/// tarayıcısında** açar. Tauri'nin macOS WKWebView'ında iframe içinden
/// `window.print()` sessizce çalışmadığı için yazdırma ve PDF dışa aktarımı
/// tarayıcıya devredilir: kullanıcı tarayıcının yazdır iletişiminden belgeyi
/// yazdırabilir ya da "PDF olarak kaydet" ile PDF'e aktarabilir. Yazılan geçici
/// dosyanın yolunu döner.
#[tauri::command]
pub async fn open_preview_in_browser(
    app: AppHandle,
    html: String,
    file_name: String,
) -> AppResult<String> {
    let safe = sanitize_file_stem(&file_name);
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = std::env::temp_dir().join(format!("{safe}-{stamp}.html"));
    tokio::fs::write(&path, html.as_bytes()).await?;

    let path_str = path.to_string_lossy().to_string();
    app.opener()
        .open_path(path_str.clone(), None::<&str>)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(path_str)
}

/// Verilen dosyada önizlenebilir belgelerin üst verisini listeler. XSLT servisini
/// **çağırmaz** (dönüşüm yapmaz); yalnızca zarfı çözüp belge başlıklarını çıkarır.
/// Böylece UI bir belge seçici kurabilir, ardından `preview_document` ile seçili
/// belgeyi tembel (lazy) olarak dönüştürür.
#[tauri::command]
pub async fn list_preview_documents(signed_path: String) -> AppResult<serde_json::Value> {
    let bytes = tokio::fs::read(&signed_path).await?;

    // XML değilse (örn. PDF/PAdES) HTML önizleme sunulamaz.
    if !looks_like_xml(&bytes) {
        return Ok(serde_json::json!({
            "previewable": false,
            "kind": "binary",
            "documents": [],
        }));
    }

    // e-Belge zarfı — içindeki tüm imzalı belgeleri çıkar.
    if envelope::looks_like_envelope(&bytes) {
        let docs = envelope::extract_signed_documents(&bytes)?;
        if !docs.is_empty() {
            let documents: Vec<serde_json::Value> = docs
                .iter()
                .enumerate()
                .map(|(index, doc)| {
                    let (document_id, uuid) = envelope::read_document_ids(&doc.xml);
                    serde_json::json!({
                        "index": index,
                        "elementType": doc.element_type,
                        "rootElementName": doc.root_local_name,
                        "documentId": document_id,
                        "uuid": uuid,
                    })
                })
                .collect();
            return Ok(serde_json::json!({
                "previewable": true,
                "kind": "envelope",
                "documents": documents,
            }));
        }
        // ElementList var ama içi boş — tekil belge olarak ele al.
    }

    // Tekil XML belge.
    let (document_id, uuid) = envelope::read_document_ids(&bytes);
    let root = envelope::read_root_local_name(&bytes).unwrap_or_else(|| "Belge".to_string());
    Ok(serde_json::json!({
        "previewable": true,
        "kind": "single",
        "documents": [{
            "index": 0,
            "elementType": serde_json::Value::Null,
            "rootElementName": root,
            "documentId": document_id,
            "uuid": uuid,
        }],
    }))
}

/// Verilen dosyadaki belirli bir belgenin **ham XML kaynağını** (zarfta `index`,
/// tekilde dosyanın tamamı) UTF-8 metin olarak döner. XSLT servisini çağırmaz;
/// salt-okunur kaynak görüntüleyici (Monaco) için kullanılır. Zarftan çıkarılan
/// belge, imza özetini bozmamak adına kaynaktaki ham bayt aralığıyla birebir
/// alınır (bkz. `envelope` modülü).
#[tauri::command]
pub async fn read_document_source(
    signed_path: String,
    index: Option<usize>,
) -> AppResult<String> {
    let bytes = tokio::fs::read(&signed_path).await?;

    // Zarfsa: ilgili belgeyi çıkar ve onun XML'ini döndür.
    if envelope::looks_like_envelope(&bytes) {
        let docs = envelope::extract_signed_documents(&bytes)?;
        if !docs.is_empty() {
            let idx = index.unwrap_or(0).min(docs.len() - 1);
            return Ok(String::from_utf8_lossy(&docs[idx].xml).into_owned());
        }
    }

    // Tekil XML belge — dosyanın tamamını döndür.
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// Verilen dosyadaki belirli bir belgeyi (zarfta `index`, tekilde 0) XSLT servisi
/// ile HTML'e dönüştürür. `use_embedded_xslt` varsayılan olarak `true`: belgenin
/// kendi gömülü tasarımı (varsa) kullanılır, böylece e-Fatura/e-Arşiv kâğıttaki
/// gibi görünür; yoksa servis varsayılan şablona düşer.
#[tauri::command]
pub async fn preview_document(
    state: State<'_, AppState>,
    signed_path: String,
    index: Option<usize>,
    transform_type: Option<String>,
    use_embedded_xslt: Option<bool>,
) -> AppResult<TransformOutput> {
    let port = running_port(&state, ServiceKind::Xslt).await?;
    let use_embedded = use_embedded_xslt.unwrap_or(true);
    let bytes = tokio::fs::read(&signed_path).await?;

    // Zarfsa: ilgili belgeyi çıkar ve onu dönüştür.
    if envelope::looks_like_envelope(&bytes) {
        let docs = envelope::extract_signed_documents(&bytes)?;
        if !docs.is_empty() {
            let idx = index.unwrap_or(0).min(docs.len() - 1);
            let doc = &docs[idx];
            let tt = transform_type.unwrap_or_else(|| {
                transform_type_for(doc.element_type.as_deref(), &doc.root_local_name).to_string()
            });
            let file_name = format!("{}-{}.xml", doc.root_local_name.to_lowercase(), idx + 1);
            return xslt::transform_bytes(port, doc.xml.clone(), &file_name, &tt, use_embedded).await;
        }
    }

    // Tekil XML belge — dosyayı doğrudan dönüştür.
    let root = envelope::read_root_local_name(&bytes).unwrap_or_else(|| "document".to_string());
    let tt =
        transform_type.unwrap_or_else(|| transform_type_for(None, &root).to_string());
    let file_name = format!("{}.xml", root.to_lowercase());
    xslt::transform_bytes(port, bytes, &file_name, &tt, use_embedded).await
}
