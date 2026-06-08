//! e-Belge zarf (envelope) ayrıştırma.
//!
//! Türkiye e-Fatura/e-İrsaliye gibi senaryolarda imzalı belgeler bir
//! `StandardBusinessDocument` zarfı içinde taşınır. Gerçek imzalı içerik(ler)
//! `…/Package/Elements/ElementList` altında **bağımsız, kendi namespace
//! tanımlarını taşıyan** kök elemanlar olarak bulunur (örn. `<Invoice …>`),
//! ve bir `ElementList` birden çok belge içerebilir.
//!
//! Bu modül zarfı gerçek bir XML ayrıştırıcısıyla (quick-xml) tarar ve
//! `ElementList`'in doğrudan çocuğu olan her elemanı **kaynaktaki ham bayt
//! aralığıyla birebir** çıkarır. Ham bayt kopyası bilinçli bir tercihtir:
//! imza özeti (digest) içeriğin kanonik formu üzerinden hesaplandığından,
//! DOM üzerinden yeniden serialize etmek ya da miras alınan (ancestor)
//! namespace bildirimlerini enjekte etmek kanonik formu değiştirip imzayı
//! geçersiz kılabilir. İmzalı belgeler zarfa konmadan önce kendi başına
//! imzalandığı için tüm namespace tanımlarını zaten kendi üzerinde taşır;
//! dolayısıyla ham aralığı çıkarmak hem en güvenli hem de en doğru yöntemdir.
//!
//! Eleman/namespace adından bağımsız çalışır: `ElementList` herhangi bir
//! önek/namespace ile gelebilir ve çocuk elemanların adı/namespace'i ne
//! olursa olsun (Invoice, CreditNote, DespatchAdvice, ApplicationResponse …)
//! tespit edilir.

use crate::error::{AppError, AppResult};
use quick_xml::events::Event;
use quick_xml::reader::Reader;

/// Zarftan çıkarılan tek bir imzalı belge.
#[derive(Debug, Clone)]
pub struct ExtractedDocument {
    /// Çevreleyen `Elements` bloğundaki `ElementType` değeri (örn. `INVOICE`),
    /// varsa.
    pub element_type: Option<String>,
    /// Çıkarılan kök elemanın yerel adı (örn. `Invoice`).
    pub root_local_name: String,
    /// Bağımsız, geçerli bir XML belgesi olarak imzalı içerik (UTF-8).
    pub xml: Vec<u8>,
}

fn local_name_bytes(name: quick_xml::name::QName<'_>) -> Vec<u8> {
    name.local_name().as_ref().to_vec()
}

/// XML bayt akışının bir e-Belge zarfı olup olmadığını (en az bir
/// `ElementList` içeriyor mu) hızlıca yoklar.
pub fn looks_like_envelope(bytes: &[u8]) -> bool {
    let mut reader = Reader::from_reader(bytes);
    reader.config_mut().trim_text(false);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                if local_name_bytes(e.name()) == b"ElementList" {
                    return true;
                }
            }
            Ok(Event::Eof) | Err(_) => return false,
            _ => {}
        }
        buf.clear();
    }
}

/// Bir XML belgesinin kök elemanının yerel adını döner (örn. `Invoice`).
/// XML olmayan içerikte (örn. PDF) `None` döner.
pub fn read_root_local_name(bytes: &[u8]) -> Option<String> {
    let mut reader = Reader::from_reader(bytes);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                return Some(String::from_utf8_lossy(&local_name_bytes(e.name())).into_owned());
            }
            Ok(Event::Eof) | Err(_) => return None,
            _ => {}
        }
    }
}

/// Bir UBL belgesinin **kök elemanın doğrudan çocuğu** olan `cbc:ID` (belge
/// numarası) ve `cbc:UUID` (ETTN) değerlerini okur. Yalnızca kök seviyesindeki
/// değerler alınır; satır/taraf gibi iç içe `ID` öğeleri (örn. `cac:…/cbc:ID`)
/// yok sayılır. XML olmayan içerikte (örn. PDF) `(None, None)` döner.
///
/// Dönüş: `(belge_no, ettn)`.
pub fn read_document_ids(bytes: &[u8]) -> (Option<String>, Option<String>) {
    let mut reader = Reader::from_reader(bytes);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut depth: i32 = 0;
    // Kök-seviyesi cbc:ID/cbc:UUID açıldığında, sıradaki metni hangi alana
    // yazacağımızı tutar.
    let mut pending: Option<&'static str> = None;
    let mut id: Option<String> = None;
    let mut uuid: Option<String> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                // Kök elemanın doğrudan çocukları parent_depth == 1'de bulunur.
                if depth == 1 {
                    match e.local_name().as_ref() {
                        b"ID" if id.is_none() => pending = Some("ID"),
                        b"UUID" if uuid.is_none() => pending = Some("UUID"),
                        _ => {}
                    }
                }
                depth += 1;
            }
            Ok(Event::Text(t)) => {
                if let Some(which) = pending.take() {
                    let val = t
                        .unescape()
                        .map(|c| c.trim().to_string())
                        .unwrap_or_default();
                    if !val.is_empty() {
                        match which {
                            "ID" => id = Some(val),
                            _ => uuid = Some(val),
                        }
                    }
                }
            }
            Ok(Event::End(_)) => {
                depth -= 1;
                pending = None;
                if id.is_some() && uuid.is_some() {
                    break;
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    (id, uuid)
}

/// Zarf içindeki tüm `ElementList` bloklarının doğrudan çocuğu olan imzalı
/// belgeleri ham bayt aralıklarıyla çıkarır.
pub fn extract_signed_documents(bytes: &[u8]) -> AppResult<Vec<ExtractedDocument>> {
    let mut reader = Reader::from_reader(bytes);
    // Ham bayt aralığını koruyacağımız için metni kırpmıyoruz.
    reader.config_mut().trim_text(false);

    let mut buf = Vec::new();
    let mut documents = Vec::new();

    // Açık eleman sayısı (kök derinliği 0).
    let mut depth: i32 = 0;
    // İçinde bulunduğumuz ElementList'in doğrudan çocuklarının derinliği.
    let mut list_child_depth: Option<i32> = None;
    // O an yakaladığımız çocuk eleman: (başlangıç bayt ofseti, kök yerel ad, derinlik).
    let mut capture: Option<(usize, String, i32)> = None;
    // En son görülen ElementType metni (çevreleyen Elements bloğundan).
    let mut last_element_type: Option<String> = None;
    // Şu an bir <ElementType> elemanının içinde miyiz (metnini okumak için).
    let mut reading_element_type = false;

    loop {
        let pos_before = reader.buffer_position() as usize;
        let event = reader
            .read_event_into(&mut buf)
            .map_err(|e| AppError::Invalid(format!("Zarf XML ayrıştırılamadı: {e}")))?;

        match event {
            Event::Start(e) => {
                let parent_depth = depth;
                let local = local_name_bytes(e.name());

                if local == b"ElementList" {
                    // Bu ElementList'in doğrudan çocukları parent_depth + 1'de açılır.
                    if list_child_depth.is_none() {
                        list_child_depth = Some(parent_depth + 1);
                    }
                } else if local == b"ElementType" {
                    reading_element_type = true;
                } else if capture.is_none() && list_child_depth == Some(parent_depth) {
                    // ElementList'in doğrudan çocuğu — yakalamayı başlat.
                    let root_local = String::from_utf8_lossy(&local).into_owned();
                    capture = Some((pos_before, root_local, parent_depth));
                }

                depth += 1;
            }
            Event::Text(e) => {
                if reading_element_type {
                    let text = e
                        .unescape()
                        .map(|c| c.trim().to_string())
                        .unwrap_or_default();
                    if !text.is_empty() {
                        last_element_type = Some(text);
                    }
                }
            }
            Event::End(_) => {
                depth -= 1;

                if reading_element_type {
                    // ElementType kapandı.
                    reading_element_type = false;
                }

                // Yakalanan çocuk eleman kapandı mı?
                if let Some((start, ref root_local, capture_depth)) = capture {
                    if depth == capture_depth {
                        let end = reader.buffer_position() as usize;
                        let mut xml: Vec<u8> =
                            b"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".to_vec();
                        xml.extend_from_slice(&bytes[start..end]);
                        documents.push(ExtractedDocument {
                            element_type: last_element_type.clone(),
                            root_local_name: root_local.clone(),
                            xml,
                        });
                        capture = None;
                    }
                }

                // İçinde bulunduğumuz ElementList kapandı mı?
                if let Some(child_depth) = list_child_depth {
                    if depth < child_depth {
                        list_child_depth = None;
                        last_element_type = None;
                    }
                }
            }
            Event::Eof => break,
            _ => {}
        }

        buf.clear();
    }

    Ok(documents)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ENVELOPE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<sh:StandardBusinessDocument xmlns:sh="urn:sh" xmlns:ef="urn:ef">
  <sh:StandardBusinessDocumentHeader>
    <sh:HeaderVersion>1.2</sh:HeaderVersion>
  </sh:StandardBusinessDocumentHeader>
  <ef:Package>
    <Elements>
      <ElementType>INVOICE</ElementType>
      <ElementCount>2</ElementCount>
      <ElementList><Invoice xmlns="urn:inv" xmlns:cac="urn:cac"><cac:ID>A1</cac:ID><Nested><Invoice>tuzak</Invoice></Nested></Invoice><Invoice xmlns="urn:inv">B2</Invoice></ElementList>
    </Elements>
  </ef:Package>
</sh:StandardBusinessDocument>"#;

    #[test]
    fn detects_envelope() {
        assert!(looks_like_envelope(ENVELOPE.as_bytes()));
        assert!(!looks_like_envelope(b"<Invoice>plain</Invoice>"));
    }

    #[test]
    fn extracts_each_element_list_child_with_exact_bytes() {
        let docs = extract_signed_documents(ENVELOPE.as_bytes()).unwrap();
        assert_eq!(docs.len(), 2, "iki imzalı belge bulunmalı");

        // İlk belge: iç içe <Invoice> tuzağına rağmen DIŞ Invoice tam çıkmalı.
        let first = String::from_utf8(docs[0].xml.clone()).unwrap();
        assert!(first.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"));
        let body0 = first.split_once('\n').unwrap().1;
        assert_eq!(
            body0,
            r#"<Invoice xmlns="urn:inv" xmlns:cac="urn:cac"><cac:ID>A1</cac:ID><Nested><Invoice>tuzak</Invoice></Nested></Invoice>"#
        );
        assert_eq!(docs[0].root_local_name, "Invoice");
        assert_eq!(docs[0].element_type.as_deref(), Some("INVOICE"));

        // İkinci belge.
        let second = String::from_utf8(docs[1].xml.clone()).unwrap();
        let body1 = second.split_once('\n').unwrap().1;
        assert_eq!(body1, r#"<Invoice xmlns="urn:inv">B2</Invoice>"#);
    }

    #[test]
    fn non_envelope_yields_nothing() {
        let docs = extract_signed_documents(b"<Invoice>plain</Invoice>").unwrap();
        assert!(docs.is_empty());
    }

    #[test]
    fn reads_root_level_id_and_uuid_only() {
        let doc = r#"<?xml version="1.0"?>
<Invoice xmlns="urn:inv" xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>TGS2026000000007</cbc:ID>
  <cbc:UUID>9c1d4e2a-0000-4b3c-aaaa-1234567890ab</cbc:UUID>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:ID>SATICI-ID-IGNORE</cbc:ID>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
  </cac:InvoiceLine>
</Invoice>"#;
        let (id, uuid) = read_document_ids(doc.as_bytes());
        assert_eq!(id.as_deref(), Some("TGS2026000000007"));
        assert_eq!(
            uuid.as_deref(),
            Some("9c1d4e2a-0000-4b3c-aaaa-1234567890ab")
        );
    }

    #[test]
    fn read_document_ids_ignores_non_xml() {
        let (id, uuid) = read_document_ids(b"%PDF-1.7\n%binary garbage <<>>");
        assert!(id.is_none());
        assert!(uuid.is_none());
    }
}
