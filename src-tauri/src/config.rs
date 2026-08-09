//! OAuth2 client registration for the built-in providers.
//!
//! Gmail, Outlook and Yahoo each require MailNext to be registered as an
//! OAuth2 "installed app" with that provider before end users can sign in.
//! Client identifiers are not secrets that belong in source control, so they
//! are read from environment variables at runtime (set them in a local
//! `.env` file during development, or bake them into the release build via
//! your CI's environment). See `README.md` for the exact scopes and redirect
//! URI pattern each provider expects.

use crate::models::Provider;

pub struct OAuthClientConfig {
    pub client_id: String,
    pub client_secret: Option<String>,
    pub auth_url: String,
    pub token_url: String,
    pub scopes: Vec<String>,
}

fn env_var(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

pub fn oauth_config_for(provider: Provider) -> Result<OAuthClientConfig, String> {
    match provider {
        Provider::Gmail => Ok(OAuthClientConfig {
            client_id: env_var("MAILNEXT_GOOGLE_CLIENT_ID").ok_or(
                "Missing MAILNEXT_GOOGLE_CLIENT_ID. Register an OAuth client at \
                 https://console.cloud.google.com/apis/credentials and set it \
                 as an environment variable.",
            )?,
            client_secret: env_var("MAILNEXT_GOOGLE_CLIENT_SECRET"),
            auth_url: "https://accounts.google.com/o/oauth2/v2/auth".into(),
            token_url: "https://oauth2.googleapis.com/token".into(),
            scopes: vec![
                "https://mail.google.com/".into(),
                "email".into(),
                "profile".into(),
            ],
        }),
        Provider::Outlook => Ok(OAuthClientConfig {
            client_id: env_var("MAILNEXT_MICROSOFT_CLIENT_ID").ok_or(
                "Missing MAILNEXT_MICROSOFT_CLIENT_ID. Register an OAuth client at \
                 https://portal.azure.com (Azure App registrations) and set it \
                 as an environment variable.",
            )?,
            client_secret: env_var("MAILNEXT_MICROSOFT_CLIENT_SECRET"),
            auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".into(),
            token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token".into(),
            scopes: vec![
                "https://outlook.office.com/IMAP.AccessAsUser.All".into(),
                "https://outlook.office.com/SMTP.Send".into(),
                "offline_access".into(),
                "email".into(),
            ],
        }),
        Provider::Yahoo => Ok(OAuthClientConfig {
            client_id: env_var("MAILNEXT_YAHOO_CLIENT_ID").ok_or(
                "Missing MAILNEXT_YAHOO_CLIENT_ID. Register an OAuth client at \
                 https://developer.yahoo.com/apps/ and set it as an \
                 environment variable.",
            )?,
            client_secret: env_var("MAILNEXT_YAHOO_CLIENT_SECRET"),
            auth_url: "https://api.login.yahoo.com/oauth2/request_auth".into(),
            token_url: "https://api.login.yahoo.com/oauth2/get_token".into(),
            scopes: vec!["mail-w".into()],
        }),
        Provider::Icloud | Provider::Custom => Err(
            "This provider signs in with a password or app-specific password, \
             not OAuth2."
                .into(),
        ),
    }
}
