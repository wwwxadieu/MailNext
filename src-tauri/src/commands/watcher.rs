//! Background polling for new mail. Each watched account/folder pair runs on
//! its own interval task; when the unseen count grows since the last check,
//! the newest message is fetched, a native toast is shown, and a
//! `mail://new-mail` event is emitted so the frontend can refresh its list
//! and (if enabled) play the notification sound.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_notification::NotificationExt;
use tokio::time::{interval, Duration};

use crate::commands::imap::{fetch_messages, unseen_count};
use crate::models::ImapConnection;

#[derive(Default)]
pub struct WatcherState(Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>);

#[derive(Clone, Serialize)]
struct NewMailPayload {
    account_email: String,
    folder: String,
    unseen_count: u32,
    subject: String,
    from: String,
}

fn watcher_key(account_email: &str, folder: &str) -> String {
    format!("{account_email}::{folder}")
}

#[tauri::command]
pub async fn start_mail_watcher(
    app: AppHandle,
    state: State<'_, WatcherState>,
    account_email: String,
    connection: ImapConnection,
    folder: String,
    interval_secs: u64,
) -> Result<(), String> {
    let key = watcher_key(&account_email, &folder);
    stop_watcher_task(&state, &key);

    let poll_interval = interval_secs.max(30);
    let handle = tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(poll_interval));
        let mut last_seen: Option<u32> = None;

        loop {
            ticker.tick().await;

            let count = match unseen_count(&connection, &folder).await {
                Ok(c) => c,
                Err(_) => continue, // transient network error; retry next tick
            };

            let is_growth = matches!(last_seen, Some(previous) if count > previous);
            last_seen = Some(count);
            if !is_growth {
                continue;
            }

            let latest = fetch_messages(&connection, &folder, 1, 0).await.ok().and_then(|mut m| m.pop());
            let (subject, from) = latest
                .map(|m| {
                    let from = m
                        .from
                        .map(|a| a.name.unwrap_or(a.address))
                        .unwrap_or_else(|| "Unknown sender".into());
                    (m.subject, from)
                })
                .unwrap_or_else(|| ("New message".into(), account_email.clone()));

            let _ = app.notification().builder().title(from.clone()).body(subject.clone()).show();

            let _ = app.emit(
                "mail://new-mail",
                NewMailPayload {
                    account_email: account_email.clone(),
                    folder: folder.clone(),
                    unseen_count: count,
                    subject,
                    from,
                },
            );
        }
    });

    state.0.lock().map_err(|_| "Watcher state poisoned")?.insert(key, handle);
    Ok(())
}

fn stop_watcher_task(state: &State<'_, WatcherState>, key: &str) {
    if let Ok(mut map) = state.0.lock() {
        if let Some(handle) = map.remove(key) {
            handle.abort();
        }
    }
}

#[tauri::command]
pub fn stop_mail_watcher(state: State<'_, WatcherState>, account_email: String, folder: String) -> Result<(), String> {
    stop_watcher_task(&state, &watcher_key(&account_email, &folder));
    Ok(())
}
