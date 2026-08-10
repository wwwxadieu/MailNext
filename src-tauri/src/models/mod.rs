use serde::{Deserialize, Serialize};

/// Identifies which well-known provider an account belongs to. Drives default
/// IMAP/SMTP hosts and which OAuth2 endpoint set to use during onboarding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Gmail,
    Outlook,
    Icloud,
    Yahoo,
    Custom,
}

impl Provider {
    pub fn as_str(&self) -> &'static str {
        match self {
            Provider::Gmail => "gmail",
            Provider::Outlook => "outlook",
            Provider::Icloud => "icloud",
            Provider::Yahoo => "yahoo",
            Provider::Custom => "custom",
        }
    }

    /// Default IMAP host/port for providers with fixed, well-known endpoints.
    pub fn default_imap(&self) -> Option<(&'static str, u16)> {
        match self {
            Provider::Gmail => Some(("imap.gmail.com", 993)),
            Provider::Outlook => Some(("outlook.office365.com", 993)),
            Provider::Icloud => Some(("imap.mail.me.com", 993)),
            Provider::Yahoo => Some(("imap.mail.yahoo.com", 993)),
            Provider::Custom => None,
        }
    }

    /// Default SMTP host/port for providers with fixed, well-known endpoints.
    pub fn default_smtp(&self) -> Option<(&'static str, u16)> {
        match self {
            Provider::Gmail => Some(("smtp.gmail.com", 465)),
            Provider::Outlook => Some(("smtp.office365.com", 587)),
            Provider::Icloud => Some(("smtp.mail.me.com", 587)),
            Provider::Yahoo => Some(("smtp.mail.yahoo.com", 465)),
            Provider::Custom => None,
        }
    }

    /// Whether this provider authenticates IMAP/SMTP via OAuth2 XOAUTH2/OAUTHBEARER.
    /// iCloud does not expose a public OAuth2 grant for third-party mail access,
    /// so it (and custom/enterprise servers) authenticate with a password or an
    /// app-specific password instead.
    pub fn uses_oauth(&self) -> bool {
        matches!(self, Provider::Gmail | Provider::Outlook | Provider::Yahoo)
    }
}

/// Connection defaults MailNext already knows for a well-known provider, sent
/// to the frontend so onboarding doesn't have to duplicate host/port tables.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderDefaults {
    pub imap: Option<MailServerConfig>,
    pub smtp: Option<MailServerConfig>,
    pub uses_oauth: bool,
}

/// Credentials needed to open an IMAP or SMTP session. `OAuthBearer` carries a
/// short-lived access token obtained via the OAuth2 authorization-code + PKCE
/// flow; `Password` carries a plain or app-specific password (iCloud/custom).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MailAuth {
    #[serde(rename_all = "camelCase")]
    Password { username: String, password: String },
    #[serde(rename_all = "camelCase")]
    OAuthBearer { username: String, access_token: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MailServerConfig {
    pub host: String,
    pub port: u16,
    /// Implicit TLS (IMAPS/SMTPS on 993/465) vs. STARTTLS on a plaintext port.
    pub implicit_tls: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImapConnection {
    pub server: MailServerConfig,
    pub auth: MailAuth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmtpConnection {
    pub server: MailServerConfig,
    pub auth: MailAuth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderInfo {
    pub name: String,
    pub path: String,
    pub special_use: Option<String>,
    pub unread_count: u32,
    pub total_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailAddress {
    pub name: Option<String>,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailAttachment {
    pub filename: String,
    pub mime_type: String,
    pub size: u64,
    pub content_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventDto {
    pub id: String,
    pub summary: String,
    /// ISO 8601 — a `dateTime` for timed events, or just a `date` (no time
    /// component) for all-day ones; see `all_day`.
    pub start: String,
    pub all_day: bool,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailMessage {
    pub uid: u32,
    pub message_id: String,
    pub subject: String,
    pub from: Option<EmailAddress>,
    pub to: Vec<EmailAddress>,
    pub cc: Vec<EmailAddress>,
    pub date: String,
    pub snippet: String,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub is_read: bool,
    pub is_flagged: bool,
    pub attachments: Vec<EmailAttachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutgoingAttachment {
    pub filename: String,
    pub mime_type: String,
    pub content_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutgoingMessage {
    pub from: EmailAddress,
    pub to: Vec<EmailAddress>,
    pub cc: Vec<EmailAddress>,
    pub bcc: Vec<EmailAddress>,
    pub subject: String,
    pub body_html: String,
    pub body_text: String,
    pub in_reply_to: Option<String>,
    pub references: Vec<String>,
    pub attachments: Vec<OutgoingAttachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthTokenResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in_secs: Option<u64>,
    pub scope: Option<String>,
    pub token_type: String,
}
