mod commands;
mod config;
mod db;
mod models;

use commands::watcher::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:mailnext.db", db::migrations())
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            commands::accounts::get_provider_defaults,
            commands::oauth::oauth_authorize,
            commands::oauth::oauth_refresh,
            commands::imap::imap_test_connection,
            commands::imap::imap_list_folders,
            commands::imap::imap_create_folder,
            commands::imap::imap_delete_folder,
            commands::imap::imap_fetch_messages,
            commands::imap::imap_set_flag,
            commands::imap::imap_move_message,
            commands::imap::imap_unseen_count,
            commands::smtp::smtp_test_connection,
            commands::smtp::smtp_send,
            commands::notifications::notify_new_mail,
            commands::watcher::start_mail_watcher,
            commands::watcher::stop_mail_watcher,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the MailNext application");
}
