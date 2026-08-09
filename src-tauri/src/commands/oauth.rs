//! Browser-based OAuth2 authorization-code + PKCE flow, using a local
//! loopback HTTP server to receive the redirect (the standard approach for
//! native/desktop "installed apps" recommended by Google, Microsoft and
//! Yahoo). The system browser is opened via `tauri-plugin-opener`; MailNext
//! also registers the `mailnext://` custom scheme as a deep-link fallback
//! (see `tauri.conf.json`) for providers/environments that block loopback
//! redirects.

use std::time::Duration;

use oauth2::basic::BasicClient;
use oauth2::reqwest::async_http_client;
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use tauri::{AppHandle, Emitter};

use crate::config::oauth_config_for;
use crate::models::{OAuthTokenResult, Provider};

const CALLBACK_TIMEOUT_SECS: u64 = 180;

fn parse_provider(provider: &str) -> Result<Provider, String> {
    match provider {
        "gmail" => Ok(Provider::Gmail),
        "outlook" => Ok(Provider::Outlook),
        "yahoo" => Ok(Provider::Yahoo),
        other => Err(format!("'{other}' does not support OAuth2 sign-in.")),
    }
}

/// Starts a one-shot HTTP server on an OS-assigned loopback port and blocks
/// (on a background thread) until it receives the provider's redirect
/// request, then returns the raw query string from that request.
fn await_callback_query(server: tiny_http::Server) -> Result<String, String> {
    let request = server
        .recv_timeout(Duration::from_secs(CALLBACK_TIMEOUT_SECS))
        .map_err(|e| format!("Local callback server error: {e}"))?
        .ok_or_else(|| "Timed out waiting for the browser sign-in to complete.".to_string())?;

    let url = request.url().to_string();
    let query = url.split_once('?').map(|(_, q)| q.to_string()).unwrap_or_default();

    let response_body = "<html><body style=\"font-family: -apple-system, sans-serif; \
        display:flex; align-items:center; justify-content:center; height:100vh; margin:0; \
        background:#0a0a0a; color:#fff;\">\
        <p>Signed in to MailNext. You can close this tab and return to the app.</p>\
        </body></html>";
    let response = tiny_http::Response::from_string(response_body)
        .with_header("Content-Type: text/html; charset=utf-8".parse::<tiny_http::Header>().unwrap());
    let _ = request.respond(response);

    Ok(query)
}

fn extract_param(query: &str, key: &str) -> Option<String> {
    url::form_urlencoded::parse(query.as_bytes())
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.into_owned())
}

#[tauri::command]
pub async fn oauth_authorize(app: AppHandle, provider: String) -> Result<OAuthTokenResult, String> {
    let provider = parse_provider(&provider)?;
    let cfg = oauth_config_for(provider)?;

    // Bind the loopback listener before building the authorize URL so the
    // redirect_uri we advertise matches the port we actually listen on.
    let server = tiny_http::Server::http("127.0.0.1:0")
        .map_err(|e| format!("Could not start local OAuth callback server: {e}"))?;
    let port = server.server_addr().to_ip().ok_or("Could not determine callback port")?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    let client = BasicClient::new(
        ClientId::new(cfg.client_id),
        cfg.client_secret.map(ClientSecret::new),
        AuthUrl::new(cfg.auth_url).map_err(|e| e.to_string())?,
        Some(TokenUrl::new(cfg.token_url).map_err(|e| e.to_string())?),
    )
    .set_redirect_uri(RedirectUrl::new(redirect_uri).map_err(|e| e.to_string())?);

    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    let mut auth_request = client
        .authorize_url(CsrfToken::new_random)
        .set_pkce_challenge(pkce_challenge);
    for scope in &cfg.scopes {
        auth_request = auth_request.add_scope(Scope::new(scope.clone()));
    }
    if provider == Provider::Gmail {
        auth_request = auth_request
            .add_extra_param("access_type", "offline")
            .add_extra_param("prompt", "consent");
    }
    let (auth_url, csrf_token) = auth_request.url();

    tauri_plugin_opener::open_url(&auth_url, None::<String>)
        .map_err(|e| format!("Could not open the system browser: {e}"))?;

    app.emit("oauth://awaiting-browser", provider.as_str())
        .map_err(|e| format!("Could not notify UI of sign-in progress: {e}"))?;

    let query = tauri::async_runtime::spawn_blocking(move || await_callback_query(server))
        .await
        .map_err(|e| format!("Callback thread failed: {e}"))??;

    if let Some(err) = extract_param(&query, "error") {
        return Err(format!("Provider denied sign-in: {err}"));
    }
    let returned_state = extract_param(&query, "state").ok_or("Missing state in callback")?;
    if returned_state != *csrf_token.secret() {
        return Err("CSRF state mismatch; aborting sign-in for your safety.".into());
    }
    let code = extract_param(&query, "code").ok_or("Missing authorization code in callback")?;

    let token = client
        .exchange_code(AuthorizationCode::new(code))
        .set_pkce_verifier(PkceCodeVerifier::new(pkce_verifier.secret().clone()))
        .request_async(async_http_client)
        .await
        .map_err(|e| format!("Token exchange failed: {e:?}"))?;

    Ok(OAuthTokenResult {
        access_token: token.access_token().secret().clone(),
        refresh_token: token.refresh_token().map(|t| t.secret().clone()),
        expires_in_secs: token.expires_in().map(|d| d.as_secs()),
        scope: token
            .scopes()
            .map(|scopes| scopes.iter().map(|s| s.to_string()).collect::<Vec<_>>().join(" ")),
        token_type: format!("{:?}", token.token_type()),
    })
}

#[tauri::command]
pub async fn oauth_refresh(provider: String, refresh_token: String) -> Result<OAuthTokenResult, String> {
    let provider = parse_provider(&provider)?;
    let cfg = oauth_config_for(provider)?;

    let client = BasicClient::new(
        ClientId::new(cfg.client_id),
        cfg.client_secret.map(ClientSecret::new),
        AuthUrl::new(cfg.auth_url).map_err(|e| e.to_string())?,
        Some(TokenUrl::new(cfg.token_url).map_err(|e| e.to_string())?),
    );

    let token = client
        .exchange_refresh_token(&oauth2::RefreshToken::new(refresh_token))
        .request_async(async_http_client)
        .await
        .map_err(|e| format!("Token refresh failed: {e:?}"))?;

    Ok(OAuthTokenResult {
        access_token: token.access_token().secret().clone(),
        refresh_token: token.refresh_token().map(|t| t.secret().clone()),
        expires_in_secs: token.expires_in().map(|d| d.as_secs()),
        scope: token
            .scopes()
            .map(|scopes| scopes.iter().map(|s| s.to_string()).collect::<Vec<_>>().join(" ")),
        token_type: format!("{:?}", token.token_type()),
    })
}
