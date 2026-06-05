//! Boş (kullanılabilir) TCP portu bulma yardımcıları.
//!
//! Yönetilen Java servisleri sabit portlar yerine "tercih edilen porttan başlayıp
//! ilk boş porta" yerleşir. Böylece port çakışması (örn. başka bir uygulama veya
//! servisin aynı portu tutması) durumunda başlatma başarısız olmaz.

use std::net::{Ipv4Addr, TcpListener};

/// Tercih edilen porttan başlayarak ilk kullanılabilir portu döner.
///
/// Sırasıyla denenir:
/// 1. `preferred` portu (boşsa onu kullan — kararlı/öngörülebilir).
/// 2. `preferred + 1 .. preferred + SCAN_RANGE` aralığı (öngörülebilir komşu portlar).
/// 3. İşletim sisteminin atadığı geçici (ephemeral) bir port.
///
/// Hiçbir port bulunamazsa son çare olarak `preferred` döner; başlatma denemesi
/// gerçek hatayı yine de raporlar.
pub fn find_free_port(preferred: u16) -> u16 {
    const SCAN_RANGE: u16 = 64;

    if is_port_available(preferred) {
        return preferred;
    }

    let start = preferred.saturating_add(1);
    let end = preferred.saturating_add(SCAN_RANGE);
    for port in start..=end {
        if port == 0 {
            continue;
        }
        if is_port_available(port) {
            return port;
        }
    }

    ephemeral_port().unwrap_or(preferred)
}

/// Bir portun loopback (127.0.0.1) üzerinde bağlanabilir (boş) olup olmadığını sınar.
///
/// Bağlanma başarılıysa listener hemen düşürülür ve port serbest kalır; ardından
/// gerçek servis (Java) bu portu tutabilir. Kısa bir yarış (TOCTOU) penceresi
/// vardır ama pratikte tek kullanıcılı masaüstü senaryosu için yeterlidir.
fn is_port_available(port: u16) -> bool {
    TcpListener::bind((Ipv4Addr::LOCALHOST, port)).is_ok()
}

/// İşletim sisteminden boş bir geçici port ister (port 0'a bağlanıp gerçek portu okur).
fn ephemeral_port() -> Option<u16> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).ok()?;
    listener.local_addr().ok().map(|addr| addr.port())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_preferred_when_free() {
        // Geçici bir portu öğren, serbest bırak, tercih edilen olarak iste.
        let p = ephemeral_port().expect("ephemeral");
        assert_eq!(find_free_port(p), p);
    }

    #[test]
    fn falls_back_when_preferred_taken() {
        // Tercih edilen portu tut; find_free_port farklı bir port dönmeli.
        let p = ephemeral_port().expect("ephemeral");
        let _held = TcpListener::bind((Ipv4Addr::LOCALHOST, p)).expect("hold");
        let chosen = find_free_port(p);
        assert_ne!(chosen, p);
        assert!(is_port_available(chosen));
    }
}
