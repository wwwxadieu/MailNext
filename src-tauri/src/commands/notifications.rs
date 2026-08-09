//! Native Windows 11 toast notifications, triggered either directly from the
//! frontend (via `@tauri-apps/plugin-notification`) or from the background
//! mail watcher when it discovers unseen messages. Audio chimes are played
//! on the frontend with the Web `Audio` API so playback stays in sync with
//! the in-app "sound enabled" setting without a second native audio stack.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn notify_new_mail(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| format!("Could not show notification: {e}"))
}
