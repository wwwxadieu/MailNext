//! Read-only Google Calendar sync for Gmail accounts — a thin REST client
//! over the Calendar API v3, using the same OAuth access token already
//! obtained for IMAP once the account has granted the `calendar.readonly`
//! scope (see `config.rs`). Every other provider keeps relying on scanning
//! .ics attachments in synced mail instead (see `src/lib/ics.ts` on the
//! frontend) — Outlook/iCloud/Yahoo calendar sync isn't implemented here.

use serde::Deserialize;

use crate::models::CalendarEventDto;

#[derive(Deserialize)]
struct GoogleEventsResponse {
    #[serde(default)]
    items: Vec<GoogleEvent>,
}

#[derive(Deserialize)]
struct GoogleEvent {
    id: String,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    location: Option<String>,
    start: GoogleEventDateTime,
}

#[derive(Deserialize)]
struct GoogleEventDateTime {
    #[serde(rename = "dateTime", default)]
    date_time: Option<String>,
    #[serde(default)]
    date: Option<String>,
}

/// Fetches upcoming events from the account's primary Google calendar.
/// Returns the sentinel errors `"unauthorized"` (access token expired —
/// the caller should refresh and retry) or `"forbidden_scope"` (token is
/// valid but was never granted `calendar.readonly`, i.e. the account needs
/// to reconnect) so the frontend can react differently to each.
#[tauri::command]
pub async fn gmail_list_calendar_events(
    access_token: String,
    time_min: String,
    time_max: String,
) -> Result<Vec<CalendarEventDto>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .bearer_auth(access_token)
        .query(&[
            ("timeMin", time_min.as_str()),
            ("timeMax", time_max.as_str()),
            ("singleEvents", "true"),
            ("orderBy", "startTime"),
            ("maxResults", "20"),
        ])
        .send()
        .await
        .map_err(|e| format!("Could not reach Google Calendar: {e}"))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("unauthorized".into());
    }
    if response.status() == reqwest::StatusCode::FORBIDDEN {
        return Err("forbidden_scope".into());
    }
    if !response.status().is_success() {
        let status = response.status();
        return Err(format!("Google Calendar API returned {status}"));
    }

    let parsed: GoogleEventsResponse = response
        .json()
        .await
        .map_err(|e| format!("Could not parse Google Calendar response: {e}"))?;

    Ok(parsed
        .items
        .into_iter()
        .filter_map(|event| {
            let (start, all_day) = match (event.start.date_time, event.start.date) {
                (Some(date_time), _) => (date_time, false),
                (None, Some(date)) => (date, true),
                (None, None) => return None,
            };
            Some(CalendarEventDto {
                id: event.id,
                summary: event.summary.unwrap_or_else(|| "(No title)".to_string()),
                start,
                all_day,
                location: event.location,
            })
        })
        .collect())
}
