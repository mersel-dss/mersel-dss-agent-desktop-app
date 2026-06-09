//! Uygulama paylaşılan durumu (Tauri `State` olarak yönetilir).

use crate::models::ServiceKind;
use crate::process::ServiceManager;
use std::collections::HashMap;
use tokio::sync::Mutex;

pub struct AppState {
    pub manager: Mutex<ServiceManager>,
    /// Servis başına son kurulum/indirme hatası. `list_services` bunu okuyup
    /// `last_error` olarak frontend'e taşır; böylece otomatik kurulum başarısız
    /// olduğunda kullanıcı nedenini görür (sessizce "kurulu değil" kalmaz).
    pub setup_errors: Mutex<HashMap<ServiceKind, String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            manager: Mutex::new(ServiceManager::new()),
            setup_errors: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
