//! XSLT önizleme servisi (port 8080) REST istemcisi.
//! e-Belge XML'lerini görüntülenebilir HTML'e dönüştürür (`POST /v1/transform`).

use super::{base_url, bytes_part, ensure_success, long_client};
use crate::error::AppResult;

/// Bir dönüşümün çıktısı: HTML gövde + hangi XSLT kaynağının kullanıldığı.
/// Servis başarı durumunda ham HTML (`text/html`) döner; meta bilgi yanıt
/// header'larından (`X-Xslt-*`) okunur.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformOutput {
    /// Dönüştürülmüş HTML belgesi.
    pub html: String,
    /// Belgenin kendi gömülü XSLT'si (EmbeddedDocumentBinaryObject) kullanıldı mı.
    pub embedded_used: bool,
    /// Varsayılan (bundled) XSLT şablonu kullanıldı mı.
    pub default_used: bool,
    /// Özel/gömülü XSLT başarısız olup varsayılana düşüldüyse hata mesajı.
    pub custom_error: Option<String>,
    /// İşlem süresi (ms), servis bildiriyorsa.
    pub duration_ms: Option<u64>,
}

/// Bellekteki e-Belge XML'ini HTML'e dönüştürür.
///
/// `transform_type`: `INVOICE` | `ARCHIVE_INVOICE` | `DESPATCH_ADVICE` |
/// `RECEIPT_ADVICE` | `EMM` | `ESMM` | `ECHECK`.
/// `use_embedded_xslt`: belgenin kendi gömülü tasarımını kullan (yoksa varsayılana düşer).
pub async fn transform_bytes(
    port: u16,
    document: Vec<u8>,
    file_name: &str,
    transform_type: &str,
    use_embedded_xslt: bool,
) -> AppResult<TransformOutput> {
    let form = reqwest::multipart::Form::new()
        .part("document", bytes_part(document, file_name.to_string())?)
        .text("transformType", transform_type.to_string())
        .text("useEmbeddedXslt", use_embedded_xslt.to_string());

    let url = format!("{}/v1/transform", base_url(port));
    let resp = ensure_success(long_client()?.post(url).multipart(form).send().await?).await?;

    let header_bool = |name: &str| {
        resp.headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(|v| v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    };
    let embedded_used = header_bool("X-Xslt-Embedded-Used");
    let default_used = header_bool("X-Xslt-Default-Used");
    let custom_error = resp
        .headers()
        .get("X-Xslt-Custom-Error")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let duration_ms = resp
        .headers()
        .get("X-Xslt-Duration-Ms")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());

    let html = resp.text().await?;
    Ok(TransformOutput {
        html,
        embedded_used,
        default_used,
        custom_error,
        duration_ms,
    })
}

/// Tek bir şematron bulgusu (kural ihlali).
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchematronFinding {
    pub rule_id: Option<String>,
    pub test: Option<String>,
    pub message: Option<String>,
}

/// e-Belge şema (XSD) + şematron doğrulama sonucu.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationOutput {
    /// Servisin otomatik tespit ettiği belge tipi (örn. `INVOICE`).
    pub detected_document_type: Option<String>,
    /// Uygulanan XSD şemasının adı/yolu (bilgi amaçlı).
    pub applied_xsd: Option<String>,
    /// Uygulanan şematron paketinin adı/yolu (bilgi amaçlı).
    pub applied_schematron: Option<String>,
    /// XSD şema doğrulaması geçti mi.
    pub valid_schema: bool,
    /// Şematron (iş kuralı) doğrulaması geçti mi.
    pub valid_schematron: bool,
    /// XSD şema hataları (serbest metin).
    pub schema_errors: Vec<String>,
    /// Şematron kural ihlalleri.
    pub schematron_errors: Vec<SchematronFinding>,
    /// Doğrulama altyapısı hata verdiyse (örn. tip tespit edilemedi) mesaj.
    pub error_message: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WireSchematronError {
    rule_id: Option<String>,
    test: Option<String>,
    message: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WireValidationResponse {
    detected_document_type: Option<String>,
    applied_xsd: Option<String>,
    applied_schematron: Option<String>,
    #[serde(default)]
    valid_schema: bool,
    #[serde(default)]
    valid_schematron: bool,
    #[serde(default)]
    schema_validation_errors: Vec<String>,
    #[serde(default)]
    schematron_validation_errors: Vec<WireSchematronError>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WireValidationEnvelope {
    error_message: Option<String>,
    result: Option<WireValidationResponse>,
}

/// Bellekteki e-Belge XML'ini şema + şematron açısından doğrular
/// (`POST /v1/validate` — belge tipi servis tarafından otomatik tespit edilir).
/// `profile`: belirli kontrolleri bastıran doğrulama profili (örn. `unsigned`);
/// `None` ise servis varsayılanı kullanılır.
pub async fn validate_bytes(
    port: u16,
    document: Vec<u8>,
    file_name: &str,
    profile: Option<&str>,
) -> AppResult<ValidationOutput> {
    let mut form = reqwest::multipart::Form::new()
        .part("source", bytes_part(document, file_name.to_string())?);
    if let Some(p) = profile {
        form = form.text("profile", p.to_string());
    }

    let url = format!("{}/v1/validate", base_url(port));
    let resp = ensure_success(long_client()?.post(url).multipart(form).send().await?).await?;
    let body = resp.text().await?;
    let env: WireValidationEnvelope =
        serde_json::from_str(&body).map_err(|e| crate::error::AppError::Invalid(e.to_string()))?;

    let result = env.result;
    Ok(ValidationOutput {
        detected_document_type: result
            .as_ref()
            .and_then(|r| r.detected_document_type.clone()),
        applied_xsd: result.as_ref().and_then(|r| r.applied_xsd.clone()),
        applied_schematron: result.as_ref().and_then(|r| r.applied_schematron.clone()),
        valid_schema: result.as_ref().map(|r| r.valid_schema).unwrap_or(false),
        valid_schematron: result.as_ref().map(|r| r.valid_schematron).unwrap_or(false),
        schema_errors: result
            .as_ref()
            .map(|r| r.schema_validation_errors.clone())
            .unwrap_or_default(),
        schematron_errors: result
            .as_ref()
            .map(|r| {
                r.schematron_validation_errors
                    .iter()
                    .map(|e| SchematronFinding {
                        rule_id: e.rule_id.clone(),
                        test: e.test.clone(),
                        message: e.message.clone(),
                    })
                    .collect()
            })
            .unwrap_or_default(),
        error_message: env.error_message,
    })
}
