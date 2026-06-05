//! Uygulama paylaşılan durumu (Tauri `State` olarak yönetilir).

use crate::process::ServiceManager;
use tokio::sync::Mutex;

pub struct AppState {
    pub manager: Mutex<ServiceManager>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            manager: Mutex::new(ServiceManager::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
