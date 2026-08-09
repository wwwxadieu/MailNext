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
  RuleAction,
  RuleCondition,
  RuleRow,
  SignatureRow,
  SpecialUse,
  TemplateRow,
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

export async function updateAccountProfile(
  accountId: string,
  displayName: string,
  color: string,
  avatarData?: string | null,
): Promise<Account> {
  await dbExecute(
    "UPDATE accounts SET display_name = ?, color = ?, avatar_data = ? WHERE id = ?",
    [displayName, color, avatarData ?? null, accountId],
  );
  const [account] = await dbSelect<Account>("SELECT * FROM accounts WHERE id = ?", [accountId]);
  if (!account) throw new Error("Failed to find updated account");
  return account;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

// Priority MailNext gives each special-use folder in the sidebar, mirroring
// how Gmail/Outlook group folders: primary mailboxes (inbox/drafts/sent/
// trash/archive — "All Mail") together at the top, inbox category tabs
// next, then user-created folders (see `folderPriority` below), with junk
// pinned to the bottom regardless of what order the server's IMAP LIST
// response happens to return them in.
const SPECIAL_USE_PRIORITY: Record<SpecialUse, number> = {
  inbox: 0,
  drafts: 1,
  sent: 2,
  trash: 3,
  archive: 4,
  promotions: 5,
  social: 6,
  shopping: 7,
  junk: 91,
};

// Custom (non special-use) folders sort after every special-use folder, so
// the sidebar can group them into their own section below a divider.
const CUSTOM_FOLDER_PRIORITY = 100;

function folderPriority(specialUse: SpecialUse | null): number {
  if (specialUse === null) return CUSTOM_FOLDER_PRIORITY;
  return SPECIAL_USE_PRIORITY[specialUse] ?? CUSTOM_FOLDER_PRIORITY;
}

export async function syncFolders(accountId: string, folders: FolderInfo[]): Promise<void> {
  for (const folder of folders) {
    const sortOrder = folderPriority(folder.specialUse);
    const [existing] = await dbSelect<FolderRow>(
      "SELECT * FROM folders WHERE account_id = ? AND path = ?",
      [accountId, folder.path],
    );
    if (existing) {
      await dbExecute(
        "UPDATE folders SET name = ?, special_use = ?, unread_count = ?, total_count = ?, sort_order = ? WHERE id = ?",
        [folder.name, folder.specialUse, folder.unreadCount, folder.totalCount, sortOrder, existing.id],
      );
    } else {
      await dbExecute(
        `INSERT INTO folders (id, account_id, name, path, special_use, unread_count, total_count, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), accountId, folder.name, folder.path, folder.specialUse, folder.unreadCount, folder.totalCount, sortOrder],
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
  specialUse: SpecialUse | null = null,
): Promise<FolderRow> {
  const id = newId();
  await dbExecute(
    "INSERT INTO folders (id, account_id, name, path, special_use, unread_count, total_count, sort_order) VALUES (?, ?, ?, ?, ?, 0, 0, ?)",
    [id, accountId, name, path, specialUse, folderPriority(specialUse)],
  );
  const [folder] = await dbSelect<FolderRow>("SELECT * FROM folders WHERE id = ?", [id]);
  if (!folder) throw new Error("Failed to create folder");
  return folder;
}

export async function deleteFolderRecord(folderId: string): Promise<void> {
  await dbExecute("DELETE FROM folders WHERE id = ?", [folderId]);
}

export async function updateFolderColor(folderId: string, color: string | null): Promise<void> {
  await dbExecute("UPDATE folders SET color = ? WHERE id = ?", [color, folderId]);
}

export async function markAllMessagesReadInFolder(folderId: string): Promise<void> {
  await dbExecute("UPDATE messages SET is_read = 1 WHERE folder_id = ?", [folderId]);
  await dbExecute("UPDATE folders SET unread_count = 0 WHERE id = ?", [folderId]);
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

/** UIDs already cached for a folder — used to tell genuinely new messages
 * (candidates for rule evaluation) from ones already synced before. */
export async function listMessageUids(folderId: string): Promise<Set<number>> {
  const rows = await dbSelect<{ uid: number }>("SELECT uid FROM messages WHERE folder_id = ?", [folderId]);
  return new Set(rows.map((r) => r.uid));
}

export async function deleteMessage(messageId: string): Promise<void> {
  await dbExecute("DELETE FROM messages WHERE id = ?", [messageId]);
}

export async function deleteMessagesByFolder(folderId: string): Promise<void> {
  await dbExecute("DELETE FROM messages WHERE folder_id = ?", [folderId]);
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

export async function addLabelToMessage(messageId: string, labelId: string): Promise<void> {
  await dbExecute(
    "INSERT OR IGNORE INTO message_labels (message_id, label_id) VALUES (?, ?)",
    [messageId, labelId],
  );
}

export async function removeLabelFromMessage(messageId: string, labelId: string): Promise<void> {
  await dbExecute("DELETE FROM message_labels WHERE message_id = ? AND label_id = ?", [messageId, labelId]);
}

export async function listLabelsForMessage(messageId: string): Promise<LabelRow[]> {
  return dbSelect<LabelRow>(
    `SELECT labels.* FROM labels
     JOIN message_labels ON message_labels.label_id = labels.id
     WHERE message_labels.message_id = ?
     ORDER BY labels.name ASC`,
    [messageId],
  );
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
// Templates
// ---------------------------------------------------------------------------

export async function listTemplates(accountId: string): Promise<TemplateRow[]> {
  return dbSelect<TemplateRow>("SELECT * FROM templates WHERE account_id = ? ORDER BY sort_order ASC", [accountId]);
}

export interface TemplateInput {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export async function createTemplate(accountId: string, input: TemplateInput): Promise<TemplateRow> {
  const id = newId();
  const countRows = await dbSelect<{ count: number }>(
    "SELECT COUNT(*) as count FROM templates WHERE account_id = ?",
    [accountId],
  );
  const count = countRows[0]?.count ?? 0;
  await dbExecute(
    "INSERT INTO templates (id, account_id, name, subject, body_html, body_text, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, accountId, input.name, input.subject, input.bodyHtml, input.bodyText, count],
  );
  const [template] = await dbSelect<TemplateRow>("SELECT * FROM templates WHERE id = ?", [id]);
  if (!template) throw new Error("Failed to create template");
  return template;
}

export async function updateTemplate(templateId: string, input: TemplateInput): Promise<void> {
  await dbExecute(
    "UPDATE templates SET name = ?, subject = ?, body_html = ?, body_text = ? WHERE id = ?",
    [input.name, input.subject, input.bodyHtml, input.bodyText, templateId],
  );
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await dbExecute("DELETE FROM templates WHERE id = ?", [templateId]);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export async function listRules(accountId: string): Promise<RuleRow[]> {
  return dbSelect<RuleRow>("SELECT * FROM rules WHERE account_id = ? ORDER BY sort_order ASC", [accountId]);
}

export interface NewRuleInput {
  name: string;
  matchType: "all" | "any";
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export async function createRule(accountId: string, input: NewRuleInput): Promise<RuleRow> {
  const id = newId();
  const countRows = await dbSelect<{ count: number }>(
    "SELECT COUNT(*) as count FROM rules WHERE account_id = ?",
    [accountId],
  );
  const count = countRows[0]?.count ?? 0;
  await dbExecute(
    `INSERT INTO rules (id, account_id, name, enabled, sort_order, match_type, conditions_json, actions_json)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
    [id, accountId, input.name, count, input.matchType, JSON.stringify(input.conditions), JSON.stringify(input.actions)],
  );
  const [rule] = await dbSelect<RuleRow>("SELECT * FROM rules WHERE id = ?", [id]);
  if (!rule) throw new Error("Failed to create rule");
  return rule;
}

export async function updateRule(ruleId: string, input: NewRuleInput): Promise<void> {
  await dbExecute(
    "UPDATE rules SET name = ?, match_type = ?, conditions_json = ?, actions_json = ? WHERE id = ?",
    [input.name, input.matchType, JSON.stringify(input.conditions), JSON.stringify(input.actions), ruleId],
  );
}

export async function setRuleEnabled(ruleId: string, enabled: boolean): Promise<void> {
  await dbExecute("UPDATE rules SET enabled = ? WHERE id = ?", [enabled ? 1 : 0, ruleId]);
}

export async function deleteRule(ruleId: string): Promise<void> {
  await dbExecute("DELETE FROM rules WHERE id = ?", [ruleId]);
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
