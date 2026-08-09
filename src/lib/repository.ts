import { dbExecute, dbSelect } from "@/lib/db";
import type {
  Account,
  EmailAddress,
  EmailMessage,
  FolderInfo,
  FolderRow,
  LabelRow,
  MessageRow,
  Provider,
  SignatureRow,
} from "@/types/mail";

export function newId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface NewAccountInput {
  email: string;
  displayName: string;
  provider: Provider;
  imapHost: string;
  imapPort: number;
  imapImplicitTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpImplicitTls: boolean;
  authType: "oauth2" | "password";
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  passwordSecret?: string;
  color: string;
}

export async function createAccount(input: NewAccountInput): Promise<Account> {
  const id = newId();
  const createdAt = Date.now();
  await dbExecute(
    `INSERT INTO accounts (
      id, email, display_name, provider, imap_host, imap_port, imap_implicit_tls,
      smtp_host, smtp_port, smtp_implicit_tls, auth_type, access_token, refresh_token,
      token_expires_at, password_secret, color, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.email,
      input.displayName,
      input.provider,
      input.imapHost,
      input.imapPort,
      input.imapImplicitTls ? 1 : 0,
      input.smtpHost,
      input.smtpPort,
      input.smtpImplicitTls ? 1 : 0,
      input.authType,
      input.accessToken ?? null,
      input.refreshToken ?? null,
      input.tokenExpiresAt ?? null,
      input.passwordSecret ?? null,
      input.color,
      0,
      createdAt,
    ],
  );
  const [account] = await dbSelect<Account>("SELECT * FROM accounts WHERE id = ?", [id]);
  if (!account) throw new Error("Failed to create account");
  return account;
}

export async function listAccounts(): Promise<Account[]> {
  return dbSelect<Account>("SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC");
}

export async function deleteAccount(accountId: string): Promise<void> {
  await dbExecute("DELETE FROM accounts WHERE id = ?", [accountId]);
}

export async function updateAccountTokens(
  accountId: string,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: number | null,
): Promise<void> {
  await dbExecute(
    "UPDATE accounts SET access_token = ?, refresh_token = COALESCE(?, refresh_token), token_expires_at = ? WHERE id = ?",
    [accessToken, refreshToken, tokenExpiresAt, accountId],
  );
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function syncFolders(accountId: string, folders: FolderInfo[]): Promise<void> {
  for (const [index, folder] of folders.entries()) {
    const [existing] = await dbSelect<FolderRow>(
      "SELECT * FROM folders WHERE account_id = ? AND path = ?",
      [accountId, folder.path],
    );
    if (existing) {
      await dbExecute(
        "UPDATE folders SET name = ?, special_use = ?, unread_count = ?, total_count = ?, sort_order = ? WHERE id = ?",
        [folder.name, folder.specialUse, folder.unreadCount, folder.totalCount, index, existing.id],
      );
    } else {
      await dbExecute(
        `INSERT INTO folders (id, account_id, name, path, special_use, unread_count, total_count, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), accountId, folder.name, folder.path, folder.specialUse, folder.unreadCount, folder.totalCount, index],
      );
    }
  }
}

export async function listFolders(accountId: string): Promise<FolderRow[]> {
  return dbSelect<FolderRow>(
    "SELECT * FROM folders WHERE account_id = ? ORDER BY sort_order ASC, name ASC",
    [accountId],
  );
}

export async function createFolderRecord(
  accountId: string,
  name: string,
  path: string,
): Promise<FolderRow> {
  const id = newId();
  await dbExecute(
    "INSERT INTO folders (id, account_id, name, path, special_use, unread_count, total_count, sort_order) VALUES (?, ?, ?, ?, NULL, 0, 0, 999)",
    [id, accountId, name, path],
  );
  const [folder] = await dbSelect<FolderRow>("SELECT * FROM folders WHERE id = ?", [id]);
  if (!folder) throw new Error("Failed to create folder");
  return folder;
}

export async function deleteFolderRecord(folderId: string): Promise<void> {
  await dbExecute("DELETE FROM folders WHERE id = ?", [folderId]);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function cacheMessages(
  accountId: string,
  folderId: string,
  messages: EmailMessage[],
): Promise<void> {
  for (const message of messages) {
    const id = `${folderId}:${message.uid}`;
    await dbExecute(
      `INSERT INTO messages (
        id, account_id, folder_id, uid, message_id, subject, from_name, from_address,
        to_json, cc_json, date, snippet, body_html, body_text, is_read, is_flagged,
        has_attachments, attachments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (folder_id, uid) DO UPDATE SET
        subject = excluded.subject, is_read = excluded.is_read, is_flagged = excluded.is_flagged`,
      [
        id,
        accountId,
        folderId,
        message.uid,
        message.messageId,
        message.subject,
        message.from?.name ?? null,
        message.from?.address ?? null,
        JSON.stringify(message.to),
        JSON.stringify(message.cc),
        message.date,
        message.snippet,
        message.bodyHtml,
        message.bodyText,
        message.isRead ? 1 : 0,
        message.isFlagged ? 1 : 0,
        message.attachments.length > 0 ? 1 : 0,
        JSON.stringify(message.attachments),
      ],
    );
  }
}

export async function listMessages(folderId: string, limit = 100): Promise<MessageRow[]> {
  return dbSelect<MessageRow>(
    "SELECT * FROM messages WHERE folder_id = ? ORDER BY date DESC LIMIT ?",
    [folderId, limit],
  );
}

export async function setMessageReadState(messageId: string, isRead: boolean): Promise<void> {
  await dbExecute("UPDATE messages SET is_read = ? WHERE id = ?", [isRead ? 1 : 0, messageId]);
}

export async function setMessageFlagged(messageId: string, isFlagged: boolean): Promise<void> {
  await dbExecute("UPDATE messages SET is_flagged = ? WHERE id = ?", [isFlagged ? 1 : 0, messageId]);
}

export function parseAddresses(json: string): EmailAddress[] {
  try {
    return JSON.parse(json) as EmailAddress[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export async function listLabels(accountId: string): Promise<LabelRow[]> {
  return dbSelect<LabelRow>("SELECT * FROM labels WHERE account_id = ? ORDER BY name ASC", [accountId]);
}

export async function createLabel(accountId: string, name: string, color: string): Promise<LabelRow> {
  const id = newId();
  await dbExecute("INSERT INTO labels (id, account_id, name, color) VALUES (?, ?, ?, ?)", [
    id,
    accountId,
    name,
    color,
  ]);
  const [label] = await dbSelect<LabelRow>("SELECT * FROM labels WHERE id = ?", [id]);
  if (!label) throw new Error("Failed to create label");
  return label;
}

export async function updateLabelColor(labelId: string, color: string): Promise<void> {
  await dbExecute("UPDATE labels SET color = ? WHERE id = ?", [color, labelId]);
}

export async function deleteLabel(labelId: string): Promise<void> {
  await dbExecute("DELETE FROM labels WHERE id = ?", [labelId]);
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

export async function listSignatures(accountId: string): Promise<SignatureRow[]> {
  return dbSelect<SignatureRow>("SELECT * FROM signatures WHERE account_id = ? ORDER BY name ASC", [
    accountId,
  ]);
}

export async function createSignature(
  accountId: string,
  name: string,
  contentHtml: string,
  contentText: string,
): Promise<SignatureRow> {
  const id = newId();
  await dbExecute(
    "INSERT INTO signatures (id, account_id, name, content_html, content_text, is_default) VALUES (?, ?, ?, ?, ?, 0)",
    [id, accountId, name, contentHtml, contentText],
  );
  const [signature] = await dbSelect<SignatureRow>("SELECT * FROM signatures WHERE id = ?", [id]);
  if (!signature) throw new Error("Failed to create signature");
  return signature;
}

export async function updateSignature(
  signatureId: string,
  name: string,
  contentHtml: string,
  contentText: string,
): Promise<void> {
  await dbExecute(
    "UPDATE signatures SET name = ?, content_html = ?, content_text = ? WHERE id = ?",
    [name, contentHtml, contentText, signatureId],
  );
}

export async function setDefaultSignature(accountId: string, signatureId: string): Promise<void> {
  await dbExecute("UPDATE signatures SET is_default = 0 WHERE account_id = ?", [accountId]);
  await dbExecute("UPDATE signatures SET is_default = 1 WHERE id = ?", [signatureId]);
}

export async function deleteSignature(signatureId: string): Promise<void> {
  await dbExecute("DELETE FROM signatures WHERE id = ?", [signatureId]);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await dbSelect<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await dbExecute(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
