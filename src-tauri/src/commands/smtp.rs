//! SMTP dispatch via `lettre`, supporting both plain/app-specific password
//! authentication and OAuth2 XOAUTH2 for providers that require it.

use base64::Engine;
use lettre::message::header::ContentType;
use lettre::message::{Attachment, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::{Credentials, Mechanism};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::models::{MailAuth, OutgoingMessage, SmtpConnection};

fn build_mailbox(addr: &crate::models::EmailAddress) -> Result<lettre::message::Mailbox, String> {
    let formatted = match &addr.name {
        Some(name) if !name.is_empty() => format!("{name} <{}>", addr.address),
        _ => addr.address.clone(),
    };
    formatted.parse().map_err(|e| format!("Invalid address '{}': {e}", addr.address))
}

fn build_transport(
    connection: &SmtpConnection,
) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    let host = connection.server.host.as_str();

    let builder = if connection.server.implicit_tls {
        AsyncSmtpTransport::<Tokio1Executor>::relay(host)
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)
    }
    .map_err(|e| format!("Could not configure SMTP transport for {host}: {e}"))?
    .port(connection.server.port);

    let (credentials, mechanism) = match &connection.auth {
        MailAuth::Password { username, password } => {
            (Credentials::new(username.clone(), password.clone()), Mechanism::Plain)
        }
        MailAuth::OAuthBearer { username, access_token } => {
            (Credentials::new(username.clone(), access_token.clone()), Mechanism::Xoauth2)
        }
    };

    Ok(builder.credentials(credentials).authentication(vec![mechanism]).build())
}

#[tauri::command]
pub async fn smtp_test_connection(connection: SmtpConnection) -> Result<bool, String> {
    let transport = build_transport(&connection)?;
    transport
        .test_connection()
        .await
        .map_err(|e| format!("SMTP connection test failed: {e}"))
}

#[tauri::command]
pub async fn smtp_send(connection: SmtpConnection, message: OutgoingMessage) -> Result<String, String> {
    let transport = build_transport(&connection)?;

    let mut builder = Message::builder()
        .from(build_mailbox(&message.from)?)
        .subject(message.subject.clone());

    for to in &message.to {
        builder = builder.to(build_mailbox(to)?);
    }
    for cc in &message.cc {
        builder = builder.cc(build_mailbox(cc)?);
    }
    for bcc in &message.bcc {
        builder = builder.bcc(build_mailbox(bcc)?);
    }
    if let Some(in_reply_to) = &message.in_reply_to {
        builder = builder.in_reply_to(in_reply_to.clone());
    }
    if !message.references.is_empty() {
        builder = builder.references(message.references.join(" "));
    }

    let body = MultiPart::alternative()
        .singlepart(
            SinglePart::builder()
                .header(ContentType::TEXT_PLAIN)
                .body(message.body_text.clone()),
        )
        .singlepart(
            SinglePart::builder()
                .header(ContentType::TEXT_HTML)
                .body(message.body_html.clone()),
        );

    let mixed = if message.attachments.is_empty() {
        MultiPart::mixed().multipart(body)
    } else {
        let mut mixed = MultiPart::mixed().multipart(body);
        for attachment in &message.attachments {
            let content = base64::engine::general_purpose::STANDARD
                .decode(&attachment.content_base64)
                .map_err(|e| format!("Invalid attachment data for '{}': {e}", attachment.filename))?;
            let content_type = ContentType::parse(&attachment.mime_type)
                .unwrap_or_else(|_| ContentType::parse("application/octet-stream").unwrap());
            mixed = mixed.singlepart(Attachment::new(attachment.filename.clone()).body(content, content_type));
        }
        mixed
    };

    let email = builder
        .multipart(mixed)
        .map_err(|e| format!("Could not build message: {e}"))?;

    let response = transport
        .send(email)
        .await
        .map_err(|e| format!("Could not send message: {e}"))?;

    Ok(response.code().to_string())
}
