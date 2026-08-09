import type { Account, ImapConnection, MailAuth, SmtpConnection } from "@/types/mail";

function authFor(account: Account): MailAuth {
  if (account.auth_type === "oauth2" && account.access_token) {
    return { kind: "o_auth_bearer", username: account.email, accessToken: account.access_token };
  }
  return { kind: "password", username: account.email, password: account.password_secret ?? "" };
}

export function toImapConnection(account: Account): ImapConnection {
  return {
    server: {
      host: account.imap_host,
      port: account.imap_port,
      implicitTls: account.imap_implicit_tls === 1,
    },
    auth: authFor(account),
  };
}

export function toSmtpConnection(account: Account): SmtpConnection {
  return {
    server: {
      host: account.smtp_host,
      port: account.smtp_port,
      implicitTls: account.smtp_implicit_tls === 1,
    },
    auth: authFor(account),
  };
}
