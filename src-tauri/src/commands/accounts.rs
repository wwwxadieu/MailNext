//! Small lookups that support the onboarding UI: known host/port defaults
//! for each built-in provider, and whether that provider signs in via
//! OAuth2 or a password/app-specific password.

use crate::models::{MailServerConfig, Provider, ProviderDefaults};

fn parse_provider(provider: &str) -> Result<Provider, String> {
    match provider {
        "gmail" => Ok(Provider::Gmail),
        "outlook" => Ok(Provider::Outlook),
        "icloud" => Ok(Provider::Icloud),
        "yahoo" => Ok(Provider::Yahoo),
        "custom" => Ok(Provider::Custom),
        other => Err(format!("Unknown provider '{other}'")),
    }
}

#[tauri::command]
pub fn get_provider_defaults(provider: String) -> Result<ProviderDefaults, String> {
    let provider = parse_provider(&provider)?;

    Ok(ProviderDefaults {
        imap: provider.default_imap().map(|(host, port)| MailServerConfig {
            host: host.to_string(),
            port,
            implicit_tls: true,
        }),
        smtp: provider.default_smtp().map(|(host, port)| MailServerConfig {
            host: host.to_string(),
            port,
            implicit_tls: port == 465,
        }),
        uses_oauth: provider.uses_oauth(),
    })
}
