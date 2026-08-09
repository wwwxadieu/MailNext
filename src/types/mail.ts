export type Provider = "gmail" | "outlook" | "icloud" | "yahoo" | "custom";

export interface MailServerConfig {
  host: string;
  port: number;
  implicitTls: boolean;
}

export type MailAuth =
  | { kind: "password"; username: string; password: string }
  | { kind: "o_auth_bearer"; username: string; accessToken: string };

export interface ImapConnection {
  server: MailServerConfig;
  auth: MailAuth;
}

export interface SmtpConnection {
  server: MailServerConfig;
  auth: MailAuth;
}

export interface ProviderDefaults {
  imap: MailServerConfig | null;
  smtp: MailServerConfig | null;
  usesOauth: boolean;
}

export interface FolderInfo {
  name: string;
  path: string;
  specialUse: SpecialUse | null;
  unreadCount: number;
  totalCount: number;
}

export type SpecialUse = "inbox" | "sent" | "drafts" | "trash" | "junk" | "archive";

export interface EmailAddress {
  name: string | null;
  address: string;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  contentBase64: string;
}

export interface EmailMessage {
  uid: number;
  messageId: string;
  subject: string;
  from: EmailAddress | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  date: string;
  snippet: string;
  bodyHtml: string | null;
  bodyText: string | null;
  isRead: boolean;
  isFlagged: boolean;
  attachments: EmailAttachment[];
}

export interface OutgoingAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export interface OutgoingMessage {
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  inReplyTo: string | null;
  references: string[];
  attachments: OutgoingAttachment[];
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresInSecs: number | null;
  scope: string | null;
  tokenType: string;
}

/** Row shape mirroring the `accounts` SQLite table (see src-tauri/migrations). */
export interface Account {
  id: string;
  email: string;
  display_name: string;
  provider: Provider;
  imap_host: string;
  imap_port: number;
  imap_implicit_tls: number;
  smtp_host: string;
  smtp_port: number;
  smtp_implicit_tls: number;
  auth_type: "oauth2" | "password";
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  password_secret: string | null;
  color: string;
  sort_order: number;
  created_at: number;
}

/** Row shape mirroring the `folders` SQLite table. */
export interface FolderRow {
  id: string;
  account_id: string;
  name: string;
  path: string;
  special_use: SpecialUse | null;
  unread_count: number;
  total_count: number;
  sort_order: number;
}

/** Row shape mirroring the `messages` SQLite table. */
export interface MessageRow {
  id: string;
  account_id: string;
  folder_id: string;
  uid: number;
  message_id: string;
  subject: string;
  from_name: string | null;
  from_address: string | null;
  to_json: string;
  cc_json: string;
  date: string;
  snippet: string;
  body_html: string | null;
  body_text: string | null;
  is_read: number;
  is_flagged: number;
  has_attachments: number;
  attachments_json: string;
}

/** Row shape mirroring the `labels` SQLite table. */
export interface LabelRow {
  id: string;
  account_id: string;
  name: string;
  color: string;
}

/** Row shape mirroring the `signatures` SQLite table. */
export interface SignatureRow {
  id: string;
  account_id: string;
  name: string;
  content_html: string;
  content_text: string;
  is_default: number;
}
