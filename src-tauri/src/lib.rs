//! Mersel İmzamatik — Tauri uygulama giriş noktası.
//! Java imza/doğrulama servislerini yönetir ve frontend'e komut köprüsü sağlar.

mod commands;
mod config;
mod download;
mod envelope;
mod error;
mod http;
mod java;
mod models;
mod net;
mod process;
mod state;

use state::AppState;
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        // Uygulamanın kendi otomatik güncelleyicisi. Bağımlılık (Cargo.toml) ve
        // updater yapılandırması (tauri.conf.json) vardı ama plugin BURADA kayıtlı
        // değildi; bu yüzden frontend'in `check()` çağrısı `plugin:updater|check`
        // komutunu bulamayıp sessizce "güncelleme yok" dönüyordu.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::new())
        .setup(|app| {
            // Windows'ta yerel (OS) başlık çubuğunu kaldır → çerçevesiz pencere.
            // Özel başlık çubuğu (frontend TopBar) sürükleme + min/maks/kapat
            // düğmelerini sağlar; böylece görünüm macOS ile birleşir. macOS
            // overlay (trafik ışıkları) ve Linux yerel dekorasyonu olduğu gibi
            // kalır (yalnız Windows hedeflenir).
            #[cfg(windows)]
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(false);
            }

            // Açılışta: jar'ları güncelle ve servisleri boş porttan başlat.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                commands::services::auto_setup(handle).await;
            });
            // Uygulama açık olduğu sürece: periyodik arka plan jar güncelleyici.
            let updater_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                commands::services::background_updater(updater_handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::detect_java,
            commands::system::detect_java_runtimes,
            commands::system::list_app_releases,
            commands::services::list_services,
            commands::services::start_service,
            commands::services::stop_service,
            commands::services::stop_all_services,
            commands::services::latest_release,
            commands::services::install_service,
            commands::services::update_service,
            commands::services::read_service_launch_logs,
            commands::signing::list_smartcards,
            commands::signing::list_certificates,
            commands::signing::sign_pades,
            commands::signing::sign_xades,
            commands::virtualcards::list_virtual_cards,
            commands::virtualcards::register_pkcs11_virtual_card,
            commands::virtualcards::register_pkcs12_virtual_card,
            commands::virtualcards::remove_virtual_card,
            commands::verification::verify_document,
            commands::verification::verify_timestamp,
            commands::timestamp::create_timestamp,
            commands::timestamp::check_tubitak_credit,
            commands::timestamp::timestamp_status,
            commands::settings::load_app_settings,
            commands::settings::save_app_settings,
            commands::preview::list_preview_documents,
            commands::preview::preview_document,
            commands::preview::read_document_source,
            commands::preview::read_file_bytes,
            commands::preview::open_preview_in_browser,
            commands::export::print_preview_document,
            commands::export::export_document_pdf,
            commands::validation::validate_document,
            commands::diagnostics::list_traces,
            commands::diagnostics::clear_traces,
            commands::diagnostics::set_traces_enabled,
            commands::diagnostics::sign_probe,
            commands::diagnostics::download_support_bundle,
            commands::system::write_text_file,
            commands::system::persist_file,
        ])
        .build(tauri::generate_context!())
        .expect("Tauri uygulaması başlatılamadı");

    app.run(|app_handle, event| {
        // Uygulama kapanırken tüm Java servislerini durdur.
        if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
            let state = app_handle.state::<AppState>();
            tauri::async_runtime::block_on(async {
                state.manager.lock().await.stop_all();
            });
        }
    });
}
