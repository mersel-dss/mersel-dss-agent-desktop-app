//! Doğrulama komutları: doküman (imza/e-Belge zarfı otomatik) ve zaman damgası.

use super::running_port;
use crate::envelope;
use crate::error::AppResult;
use crate::http::verifier;
use crate::models::ServiceKind;
use crate::state::AppState;
use std::path::{Path, PathBuf};
use tauri::State;

fn opt_path(value: &Option<String>) -> Option<PathBuf> {
    value.as_ref().map(PathBuf::from)
}

/// İmzalı dokümanı doğrular — **e-Belge zarfı (StandardBusinessDocument)
/// otomatik tespit edilir**. Dosya bir zarfsa `ElementList` altındaki tüm
/// imzalı belgeler namespace'lerine sadık biçimde çıkarılıp tek tek doğrulanır
/// ve `kind: "envelope"` özetiyle döner; değilse tekil imza doğrulaması yapılıp
/// `kind: "signature"` ile döner. Böylece kullanıcı dosya türünü ayırt etmeden
/// tek ekrandan doğrulama yapar.
///
/// `level`: `SIMPLE` | `COMPREHENSIVE`. `include_failed_constraints`: kapsamlı
/// doğrulama detayı (tüm FAIL constraint'leri).
#[tauri::command]
pub async fn verify_document(
    state: State<'_, AppState>,
    signed_path: String,
    original_path: Option<String>,
    level: Option<String>,
    include_failed_constraints: Option<bool>,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Verifier).await?;
    let level = level.unwrap_or_else(|| "COMPREHENSIVE".to_string());
    let include_failed = include_failed_constraints.unwrap_or(false);

    let bytes = tokio::fs::read(&signed_path).await?;

    // SBD zarfı mı? Öyleyse otomatik çöz ve içindeki tüm belgeleri doğrula.
    if envelope::looks_like_envelope(&bytes) {
        if let Some(envelope_result) =
            verify_envelope_contents(port, &bytes, &level, include_failed).await?
        {
            return Ok(serde_json::json!({
                "kind": "envelope",
                "envelope": envelope_result,
                "signature": serde_json::Value::Null,
            }));
        }
        // ElementList var ama içi boş — tekil imza doğrulamasına düş.
    }

    // Tekil imzalı doküman (XAdES/PAdES/CAdES) doğrulaması.
    let original = opt_path(&original_path);
    let signature = verifier::verify_signature(
        port,
        Path::new(&signed_path),
        original.as_deref(),
        &level,
        include_failed,
    )
    .await?;

    // UBL ise belge numarası (cbc:ID) ve ETTN (cbc:UUID) bilgisini ekle.
    let (document_id, uuid) = if looks_like_xml(&bytes) {
        envelope::read_document_ids(&bytes)
    } else {
        (None, None)
    };

    Ok(serde_json::json!({
        "kind": "signature",
        "envelope": serde_json::Value::Null,
        "signature": signature,
        "documentId": document_id,
        "uuid": uuid,
    }))
}

/// İçeriğin XML gibi görünüp görünmediğini ucuzca yoklar (ilk boşluk-dışı
/// karakter `<` mı). PDF gibi ikili içeriği gereksiz yere ayrıştırmamak için.
fn looks_like_xml(bytes: &[u8]) -> bool {
    bytes
        .iter()
        .find(|b| !b.is_ascii_whitespace())
        .map(|b| *b == b'<')
        .unwrap_or(false)
}

/// Zarf baytlarındaki tüm imzalı belgeleri çıkarıp tek tek doğrular. İçerik
/// yoksa `None` döner (çağıran tekil imza doğrulamasına düşebilir).
async fn verify_envelope_contents(
    port: u16,
    bytes: &[u8],
    level: &str,
    include_failed: bool,
) -> AppResult<Option<serde_json::Value>> {
    let documents = envelope::extract_signed_documents(bytes)?;
    if documents.is_empty() {
        return Ok(None);
    }

    let mut results = Vec::with_capacity(documents.len());
    for (index, doc) in documents.into_iter().enumerate() {
        let file_name = format!("{}-{}.xml", doc.root_local_name.to_lowercase(), index + 1);
        // Belge numarası (cbc:ID) ve ETTN (cbc:UUID) — baytlar doğrulamaya
        // taşınmadan önce okunur.
        let (document_id, uuid) = envelope::read_document_ids(&doc.xml);
        let element_type = doc.element_type.clone();
        let root_local_name = doc.root_local_name.clone();
        let outcome =
            verifier::verify_signature_bytes(port, doc.xml, &file_name, level, include_failed)
                .await;

        let entry = match outcome {
            Ok(result) => serde_json::json!({
                "index": index,
                "elementType": element_type,
                "rootElementName": root_local_name,
                "documentId": document_id,
                "uuid": uuid,
                "result": result,
                "error": serde_json::Value::Null,
            }),
            Err(e) => serde_json::json!({
                "index": index,
                "elementType": element_type,
                "rootElementName": root_local_name,
                "documentId": document_id,
                "uuid": uuid,
                "result": serde_json::Value::Null,
                "error": e.to_string(),
            }),
        };
        results.push(entry);
    }

    let total = results.len();
    let valid_count = results
        .iter()
        .filter(|d| {
            d.get("result")
                .and_then(|r| r.get("valid"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
        })
        .count();

    Ok(Some(serde_json::json!({
        "documentCount": total,
        "validCount": valid_count,
        "documents": results,
    })))
}

/// RFC 3161 zaman damgasını doğrular.
#[tauri::command]
pub async fn verify_timestamp(
    state: State<'_, AppState>,
    timestamp_path: String,
    original_path: Option<String>,
    validate_certificate: Option<bool>,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Verifier).await?;
    let original = opt_path(&original_path);
    verifier::verify_timestamp(
        port,
        Path::new(&timestamp_path),
        original.as_deref(),
        validate_certificate.unwrap_or(true),
    )
    .await
}
