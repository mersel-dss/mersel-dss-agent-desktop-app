//! e-Belge şema (XSD) + şematron doğrulama komutları. XSLT servisinin
//! `/v1/validate` (otomatik tespit) uç noktasını kullanır. Verilen dosya bir
//! e-Belge zarfıysa (StandardBusinessDocument) içindeki belirli belge çıkarılıp
//! doğrulanır; tekil XML belge ise doğrudan doğrulanır.

use super::running_port;
use crate::envelope;
use crate::error::AppResult;
use crate::http::xslt::{self, ValidationOutput};
use crate::models::ServiceKind;
use crate::state::AppState;
use tauri::State;

/// Verilen dosyadaki belirli bir belgeyi (zarfta `index`, tekilde 0) GİB resmi
/// XSD şeması ve şematron kurallarına göre doğrular. Belge tipi servis
/// tarafından otomatik tespit edilir; sonuçta tespit edilen tip, şema ve
/// şematron geçerliliği ile hata/ihlal listeleri döner.
#[tauri::command]
pub async fn validate_document(
    state: State<'_, AppState>,
    signed_path: String,
    index: Option<usize>,
) -> AppResult<ValidationOutput> {
    let port = running_port(&state, ServiceKind::Xslt).await?;
    let bytes = tokio::fs::read(&signed_path).await?;

    // Zarfsa: ilgili belgeyi çıkar ve onu doğrula.
    if envelope::looks_like_envelope(&bytes) {
        let docs = envelope::extract_signed_documents(&bytes)?;
        if !docs.is_empty() {
            let idx = index.unwrap_or(0).min(docs.len() - 1);
            let doc = &docs[idx];
            let file_name = format!("{}-{}.xml", doc.root_local_name.to_lowercase(), idx + 1);
            return xslt::validate_bytes(port, doc.xml.clone(), &file_name, None).await;
        }
    }

    // Tekil XML belge — dosyayı doğrudan doğrula.
    let root = envelope::read_root_local_name(&bytes).unwrap_or_else(|| "document".to_string());
    let file_name = format!("{}.xml", root.to_lowercase());
    xslt::validate_bytes(port, bytes, &file_name, None).await
}
