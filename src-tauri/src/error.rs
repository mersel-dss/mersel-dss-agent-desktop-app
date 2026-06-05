//! Uygulama genelinde tek hata tipi. Tauri komutları `Result<_, AppError>` döner;
//! `serde::Serialize` ile frontend'e okunabilir bir mesaj olarak iletilir.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Java runtime bulunamadı. Lütfen Java 8 veya üzeri kurun.")]
    JavaNotFound,

    #[error("Servis jar dosyası bulunamadı: {0}")]
    JarNotFound(String),

    #[error("Servis başlatılamadı: {0}")]
    ServiceStart(String),

    #[error("Servis '{0}' zaten çalışıyor.")]
    AlreadyRunning(String),

    #[error("Ağ hatası: {0}")]
    Http(String),

    #[error("Servis hatası ({status}): {body}")]
    ServiceResponse { status: u16, body: String },

    #[error("Dosya hatası: {0}")]
    Io(String),

    #[error("Geçersiz işlem: {0}")]
    Invalid(String),
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Http(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
