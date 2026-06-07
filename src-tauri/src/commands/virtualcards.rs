//! Sanal kart (Dummy Card) komutları: kart takılı olmasa bile PFX/PKCS#11
//! kaynaklarını "sanal kart" olarak tanımlama, listeleme ve kaldırma.

use super::running_port;
use crate::error::AppResult;
use crate::http::agent;
use crate::models::ServiceKind;
use crate::state::AppState;
use std::path::Path;
use tauri::State;

/// Tanımlı sanal kartları listeler.
#[tauri::command]
pub async fn list_virtual_cards(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    agent::list_virtual_cards(port).await
}

/// PKCS#11 (HSM / yüklü sürücü) sanal kart tanımlar.
#[tauri::command]
pub async fn register_pkcs11_virtual_card(
    state: State<'_, AppState>,
    name: String,
    library_path: String,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    agent::register_pkcs11_virtual_card(port, &name, &library_path).await
}

/// PKCS#12 (PFX) sanal kart tanımlar. PFX dosyası diskten okunup parolasıyla
/// birlikte ajana yüklenir; parola yalnızca ajana iletilir, burada saklanmaz.
#[tauri::command]
pub async fn register_pkcs12_virtual_card(
    state: State<'_, AppState>,
    name: String,
    file_path: String,
    password: String,
) -> AppResult<serde_json::Value> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    agent::register_pkcs12_virtual_card(port, &name, Path::new(&file_path), &password).await
}

/// Bir sanal kartı kaldırır.
#[tauri::command]
pub async fn remove_virtual_card(state: State<'_, AppState>, name: String) -> AppResult<()> {
    let port = running_port(&state, ServiceKind::Agent).await?;
    agent::remove_virtual_card(port, &name).await
}
