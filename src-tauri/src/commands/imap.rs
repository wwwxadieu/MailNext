//! IMAP client commands: connection testing, folder listing/management and
//! message fetching. Every command opens a short-lived TLS session, performs
//! its operation, and logs out — MailNext relies on periodic polling
//! (`commands::watcher`) rather than a long-lived IDLE connection, which
//! keeps the connection-handling code simple and robust across sleep/wake
//! and network changes on a laptop.

use async_imap::types::Fetch;
use futures::TryStreamExt;
use mail_parser::{MessageParser, MimeHeaders};
use tokio::net::TcpStream;

use crate::models::{
    EmailAddress, EmailAttachment, EmailMessage, FolderInfo, ImapConnection, MailAuth,
};

type ImapSession = async_imap::Session<tokio_native_tls::TlsStream<TcpStream>>;

struct XOAuth2 {
    user: String,
    access_token: String,
}

impl async_imap::Authenticator for XOAuth2 {
    type Response = String;

    fn process(&mut self, _challenge: &[u8]) -> Self::Response {
        format!("user={}\x01auth=Bearer {}\x01\x01", self.user, self.access_token)
    }
}

pub(crate) async fn connect(conn: &ImapConnection) -> Result<ImapSession, String> {
    let tcp = TcpStream::connect((conn.server.host.as_str(), conn.server.port))
        .await
        .map_err(|e| format!("Could not reach {}:{}: {e}", conn.server.host, conn.server.port))?;

    let native_connector = native_tls::TlsConnector::new().map_err(|e| format!("Could not initialize TLS: {e}"))?;
    let tls = tokio_native_tls::TlsConnector::from(native_connector);
    let tls_stream = tls
        .connect(conn.server.host.as_str(), tcp)
        .await
        .map_err(|e| format!("TLS handshake failed: {e}"))?;

    let client = async_imap::Client::new(tls_stream);

    let session = match &conn.auth {
        MailAuth::Password { username, password } => client
            .login(username, password)
            .await
            .map_err(|(e, _)| format!("IMAP login failed: {e}"))?,
        MailAuth::OAuthBearer { username, access_token } => {
            let authenticator = XOAuth2 {
                user: username.clone(),
                access_token: access_token.clone(),
            };
            client
                .authenticate("XOAUTH2", authenticator)
                .await
                .map_err(|(e, _)| format!("IMAP OAuth2 authentication failed: {e}"))?
        }
    };

    Ok(session)
}

#[tauri::command]
pub async fn imap_test_connection(connection: ImapConnection) -> Result<bool, String> {
    let mut session = connect(&connection).await?;
    session.logout().await.map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn imap_list_folders(connection: ImapConnection) -> Result<Vec<FolderInfo>, String> {
    let mut session = connect(&connection).await?;

    let names: Vec<_> = session
        .list(Some(""), Some("*"))
        .await
        .map_err(|e| format!("Could not list folders: {e}"))?
        .try_collect()
        .await
        .map_err(|e| format!("Could not read folder list: {e}"))?;

    let mut folders = Vec::with_capacity(names.len());
    for name in &names {
        let path = name.name().to_string();
        let special_use = classify_special_use(&path);

        let (unread, total) = match session.examine(&path).await {
            Ok(mailbox) => {
                let unseen = session
                    .uid_search("UNSEEN")
                    .await
                    .map(|set| set.len() as u32)
                    .unwrap_or(0);
                (unseen, mailbox.exists)
            }
            Err(_) => (0, 0),
        };

        let raw_name = path.rsplit('/').next().unwrap_or(&path);
        folders.push(FolderInfo {
            name: decode_imap_utf7(raw_name),
            path,
            special_use,
            unread_count: unread,
            total_count: total,
        });
    }

    session.logout().await.map_err(|e| e.to_string())?;
    Ok(folders)
}

/// Decodes an IMAP mailbox name from modified UTF-7 (RFC 3501 §5.1.3) to a
/// normal Rust `String`, for display purposes only. The raw, still-encoded
/// name must keep being used for any IMAP command (SELECT/EXAMINE/etc.) —
/// this is applied solely to `FolderInfo.name`, never to `.path`.
fn decode_imap_utf7(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut result = String::with_capacity(input.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'&' {
            let start = i + 1;
            let mut j = start;
            while j < bytes.len() && bytes[j] != b'-' {
                j += 1;
            }
            let chunk = &input[start..j];
            if chunk.is_empty() {
                result.push('&');
            } else {
                match decode_modified_base64(chunk) {
                    Some(decoded) => result.push_str(&decoded),
                    None => {
                        // Not valid modified UTF-7 — keep the original bytes
                        // rather than risk garbling something else entirely.
                        result.push('&');
                        result.push_str(chunk);
                        if j < bytes.len() {
                            result.push('-');
                        }
                    }
                }
            }
            i = if j < bytes.len() { j + 1 } else { j };
        } else {
            result.push(bytes[i] as char);
            i += 1;
        }
    }
    result
}

fn decode_modified_base64(chunk: &str) -> Option<String> {
    use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine as _};
    let standard: String = chunk.chars().map(|c| if c == ',' { '/' } else { c }).collect();
    let bytes = STANDARD_NO_PAD.decode(standard.as_bytes()).ok()?;
    if bytes.len() % 2 != 0 {
        return None;
    }
    let units: Vec<u16> = bytes.chunks_exact(2).map(|c| u16::from_be_bytes([c[0], c[1]])).collect();
    String::from_utf16(&units).ok()
}

/// Converts HTML to plain text for the message-preview snippet, skipping
/// `<style>`/`<script>` block contents entirely (unlike `mail-parser`'s own
/// html-to-text fallback, which doesn't).
fn strip_html_to_text(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let lower = html.to_ascii_lowercase();
    let mut i = 0;
    while i < html.len() {
        if html.as_bytes()[i] == b'<' {
            if lower[i..].starts_with("<style") {
                match lower[i..].find("</style>") {
                    Some(end) => i += end + "</style>".len(),
                    None => break,
                }
            } else if lower[i..].starts_with("<script") {
                match lower[i..].find("</script>") {
                    Some(end) => i += end + "</script>".len(),
                    None => break,
                }
            } else {
                match html[i..].find('>') {
                    Some(end) => {
                        result.push(' ');
                        i += end + 1;
                    }
                    None => break,
                }
            }
        } else {
            let next_lt = html[i..].find('<').map(|p| i + p).unwrap_or(html.len());
            result.push_str(&html[i..next_lt]);
            i = next_lt;
        }
    }
    decode_html_entities(&result)
}

fn decode_html_entities(input: &str) -> String {
    input
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
}

fn classify_special_use(path: &str) -> Option<String> {
    let upper = path.to_uppercase();
    if upper.contains("INBOX") && !upper.contains('/') {
        Some("inbox".into())
    } else if upper.contains("SENT") {
        Some("sent".into())
    } else if upper.contains("DRAFT") {
        Some("drafts".into())
    } else if upper.contains("TRASH") || upper.contains("DELETED") {
        Some("trash".into())
    } else if upper.contains("JUNK") || upper.contains("SPAM") {
        Some("junk".into())
    } else if upper.contains("ARCHIVE") || upper.contains("ALL MAIL") {
        Some("archive".into())
    } else {
        None
    }
}

#[tauri::command]
pub async fn imap_create_folder(connection: ImapConnection, path: String) -> Result<(), String> {
    let mut session = connect(&connection).await?;
    session
        .create(&path)
        .await
        .map_err(|e| format!("Could not create folder '{path}': {e}"))?;
    session.logout().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn imap_delete_folder(connection: ImapConnection, path: String) -> Result<(), String> {
    let mut session = connect(&connection).await?;
    session
        .delete(&path)
        .await
        .map_err(|e| format!("Could not delete folder '{path}': {e}"))?;
    session.logout().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn imap_fetch_messages(
    connection: ImapConnection,
    folder: String,
    limit: u32,
    offset: u32,
) -> Result<Vec<EmailMessage>, String> {
    fetch_messages(&connection, &folder, limit, offset).await
}

pub(crate) async fn fetch_messages(
    connection: &ImapConnection,
    folder: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<EmailMessage>, String> {
    let mut session = connect(connection).await?;

    let mailbox = session
        .select(&folder)
        .await
        .map_err(|e| format!("Could not open folder '{folder}': {e}"))?;

    if mailbox.exists == 0 {
        session.logout().await.map_err(|e| e.to_string())?;
        return Ok(vec![]);
    }

    let highest = mailbox.exists;
    let end = highest.saturating_sub(offset).max(1);
    let start = end.saturating_sub(limit).max(1);
    let sequence_set = format!("{start}:{end}");

    let fetches: Vec<Fetch> = session
        .fetch(&sequence_set, "(UID FLAGS INTERNALDATE BODY.PEEK[])")
        .await
        .map_err(|e| format!("Fetch failed: {e}"))?
        .try_collect()
        .await
        .map_err(|e| format!("Could not read fetched messages: {e}"))?;

    let parser = MessageParser::default();
    let mut messages: Vec<EmailMessage> = fetches
        .iter()
        .filter_map(|fetch| {
            let uid = fetch.uid?;
            let body = fetch.body()?;
            let parsed = parser.parse(body)?;

            let is_read = fetch.flags().any(|f| matches!(f, async_imap::types::Flag::Seen));
            let is_flagged = fetch.flags().any(|f| matches!(f, async_imap::types::Flag::Flagged));

            let from = parsed.from().and_then(|addrs| addrs.first()).map(|a| EmailAddress {
                name: a.name().map(|n| n.to_string()),
                address: a.address().unwrap_or_default().to_string(),
            });
            let to = parsed
                .to()
                .map(|addrs| {
                    addrs
                        .iter()
                        .map(|a| EmailAddress {
                            name: a.name().map(|n| n.to_string()),
                            address: a.address().unwrap_or_default().to_string(),
                        })
                        .collect()
                })
                .unwrap_or_default();
            let cc = parsed
                .cc()
                .map(|addrs| {
                    addrs
                        .iter()
                        .map(|a| EmailAddress {
                            name: a.name().map(|n| n.to_string()),
                            address: a.address().unwrap_or_default().to_string(),
                        })
                        .collect()
                })
                .unwrap_or_default();

            let body_text = parsed.body_text(0).map(|c| c.to_string());
            let body_html = parsed.body_html(0).map(|c| c.to_string());
            // Prefer stripping the raw HTML ourselves for the preview snippet:
            // `body_text()` falls back to the `mail-parser` crate's own
            // html-to-text conversion when there's no genuine text/plain
            // part, and that conversion doesn't skip <style>/<script>
            // blocks — leaking raw CSS into message previews for any HTML
            // email that puts a <style> tag in the body (common for
            // Outlook-compatible newsletters).
            let snippet_source = body_html
                .as_deref()
                .map(strip_html_to_text)
                .or_else(|| body_text.clone());
            let snippet = snippet_source
                .unwrap_or_default()
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
                .chars()
                .take(160)
                .collect::<String>();

            let attachments = parsed
                .attachments()
                .map(|att| EmailAttachment {
                    filename: att.attachment_name().unwrap_or("attachment").to_string(),
                    mime_type: att
                        .content_type()
                        .map(|ct| ct.ctype().to_string())
                        .unwrap_or_else(|| "application/octet-stream".to_string()),
                    size: att.contents().len() as u64,
                    content_base64: base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        att.contents(),
                    ),
                })
                .collect();

            Some(EmailMessage {
                uid,
                message_id: parsed.message_id().unwrap_or_default().to_string(),
                subject: parsed.subject().unwrap_or("(no subject)").to_string(),
                from,
                to,
                cc,
                date: parsed
                    .date()
                    .map(|d| d.to_rfc3339())
                    .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
                snippet,
                body_html,
                body_text,
                is_read,
                is_flagged,
                attachments,
            })
        })
        .collect();

    messages.sort_by(|a, b| b.date.cmp(&a.date));

    session.logout().await.map_err(|e| e.to_string())?;
    Ok(messages)
}

#[tauri::command]
pub async fn imap_set_flag(
    connection: ImapConnection,
    folder: String,
    uid: u32,
    flag: String,
    value: bool,
) -> Result<(), String> {
    let mut session = connect(&connection).await?;
    session
        .select(&folder)
        .await
        .map_err(|e| format!("Could not open folder '{folder}': {e}"))?;

    let op = if value { "+FLAGS" } else { "-FLAGS" };
    let query = format!("{op} ({flag})");
    session
        .uid_store(uid.to_string(), query)
        .await
        .map_err(|e| format!("Could not update flags: {e}"))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| format!("Could not confirm flag update: {e}"))?;

    session.logout().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn imap_move_message(
    connection: ImapConnection,
    folder: String,
    uid: u32,
    destination: String,
) -> Result<(), String> {
    let mut session = connect(&connection).await?;
    session
        .select(&folder)
        .await
        .map_err(|e| format!("Could not open folder '{folder}': {e}"))?;

    session
        .uid_mv(uid.to_string(), &destination)
        .await
        .map_err(|e| format!("Could not move message: {e}"))?;

    session.logout().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn imap_unseen_count(connection: ImapConnection, folder: String) -> Result<u32, String> {
    unseen_count(&connection, &folder).await
}

pub(crate) async fn unseen_count(connection: &ImapConnection, folder: &str) -> Result<u32, String> {
    let mut session = connect(connection).await?;
    session
        .examine(folder)
        .await
        .map_err(|e| format!("Could not open folder '{folder}': {e}"))?;
    let unseen = session
        .uid_search("UNSEEN")
        .await
        .map(|set| set.len() as u32)
        .map_err(|e| format!("Could not search folder: {e}"))?;
    session.logout().await.map_err(|e| e.to_string())?;
    Ok(unseen)
}
