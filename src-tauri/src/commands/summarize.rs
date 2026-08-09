//! On-demand email summaries via the Claude API (Messages endpoint). Uses
//! Claude Haiku 4.5 — fast and inexpensive, which fits a short, frequent
//! per-email summarization call far better than a larger model. The API key
//! is supplied by the user (stored locally via `plugin-sql` settings) and
//! passed in per-request; MailNext never bundles a key of its own.

use serde::{Deserialize, Serialize};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const SUMMARY_MODEL: &str = "claude-haiku-4-5";
const MAX_BODY_CHARS: usize = 6000;

#[derive(Serialize)]
struct MessagesRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: Vec<RequestMessage<'a>>,
}

#[derive(Serialize)]
struct RequestMessage<'a> {
    role: &'a str,
    content: String,
}

#[derive(Deserialize)]
struct MessagesResponse {
    content: Vec<ResponseBlock>,
}

#[derive(Deserialize)]
struct ResponseBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicErrorBody {
    error: AnthropicErrorDetail,
}

#[derive(Deserialize)]
struct AnthropicErrorDetail {
    message: String,
}

fn truncate_body(body: &str) -> String {
    if body.chars().count() <= MAX_BODY_CHARS {
        return body.to_string();
    }
    let truncated: String = body.chars().take(MAX_BODY_CHARS).collect();
    format!("{truncated}\n\n[…message truncated for summarization…]")
}

#[tauri::command]
pub async fn summarize_email(api_key: String, subject: String, body: String) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("No Anthropic API key configured. Add one in Settings > AI Summary.".into());
    }
    if body.trim().is_empty() {
        return Err("This message has no readable content to summarize.".into());
    }

    let client = reqwest::Client::new();

    let user_content = format!(
        "Subject: {subject}\n\n{body}",
        body = truncate_body(&body)
    );

    let request = MessagesRequest {
        model: SUMMARY_MODEL,
        max_tokens: 300,
        system: "You summarize emails for someone triaging their inbox. Reply with 2-3 \
                 concise, plain-text sentences capturing the key point, any request or \
                 deadline, and who it's from if relevant. No markdown, no preamble like \
                 'This email is about' — start directly with the substance.",
        messages: vec![RequestMessage { role: "user", content: user_content }],
    };

    let response = client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Could not reach the Claude API: {e}"))?;

    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Could not read the Claude API response: {e}"))?;

    if !status.is_success() {
        let message = serde_json::from_slice::<AnthropicErrorBody>(&bytes)
            .map(|body| body.error.message)
            .unwrap_or_else(|_| format!("HTTP {status}"));
        return Err(format!("Claude API error: {message}"));
    }

    let parsed: MessagesResponse =
        serde_json::from_slice(&bytes).map_err(|e| format!("Could not parse the Claude API response: {e}"))?;

    let summary = parsed
        .content
        .into_iter()
        .find(|block| block.block_type == "text")
        .and_then(|block| block.text)
        .ok_or("Claude API returned no summary text.")?;

    Ok(summary.trim().to_string())
}
