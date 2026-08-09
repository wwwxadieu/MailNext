import { save, open } from "@tauri-apps/plugin-dialog";
import { format } from "date-fns";
import * as commands from "@/lib/commands";
import { dbExecute, dbSelect } from "@/lib/db";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import type {
  Account,
  FolderRow,
  MessageRow,
  RuleRow,
  SignatureRow,
  TemplateRow,
} from "@/types/mail";

export interface BackupPayload {
  appName: string;
  version: string;
  createdAt: string;
  data: {
    accounts: Account[];
    folders: FolderRow[];
    messages: MessageRow[];
    rules: RuleRow[];
    templates: TemplateRow[];
    signatures: SignatureRow[];
    settings: { key: string; value: string }[];
  };
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  accountsCount: number;
  foldersCount: number;
  messagesCount: number;
  rulesCount: number;
  templatesCount: number;
  signaturesCount: number;
}

export async function exportBackup(): Promise<BackupResult | null> {
  const [accounts, folders, messages, rules, templates, signatures, settings] = await Promise.all([
    dbSelect<Account>("SELECT * FROM accounts"),
    dbSelect<FolderRow>("SELECT * FROM folders"),
    dbSelect<MessageRow>("SELECT * FROM messages"),
    dbSelect<RuleRow>("SELECT * FROM rules"),
    dbSelect<TemplateRow>("SELECT * FROM templates"),
    dbSelect<SignatureRow>("SELECT * FROM signatures"),
    dbSelect<{ key: string; value: string }>("SELECT * FROM settings"),
  ]);

  const payload: BackupPayload = {
    appName: "MailNext",
    version: "1.0",
    createdAt: new Date().toISOString(),
    data: {
      accounts,
      folders,
      messages,
      rules,
      templates,
      signatures,
      settings,
    },
  };

  const defaultFileName = `MailNext-Backup-${format(new Date(), "yyyy-MM-dd")}.mnbak`;
  const filePath = await save({
    defaultPath: defaultFileName,
    filters: [{ name: "MailNext Backup (*.mnbak)", extensions: ["mnbak", "json"] }],
  });

  if (!filePath) return null;

  const content = JSON.stringify(payload, null, 2);
  await commands.saveBackupFile(filePath, content);

  return {
    success: true,
    filePath,
    accountsCount: accounts.length,
    foldersCount: folders.length,
    messagesCount: messages.length,
    rulesCount: rules.length,
    templatesCount: templates.length,
    signaturesCount: signatures.length,
  };
}

export async function importBackup(): Promise<BackupResult | null> {
  const filePath = await open({
    multiple: false,
    filters: [{ name: "MailNext Backup (*.mnbak)", extensions: ["mnbak", "json"] }],
  });

  if (!filePath || typeof filePath !== "string") return null;

  const raw = await commands.readBackupFile(filePath);
  const payload = JSON.parse(raw) as BackupPayload;

  if (!payload.data || !Array.isArray(payload.data.accounts)) {
    throw new Error("Tệp sao lưu không đúng định dạng MailNext (.mnbak)");
  }

  const { data } = payload;

  // Restore accounts
  for (const acc of data.accounts) {
    await dbExecute(
      `INSERT INTO accounts (id, email, display_name, provider, imap_host, imap_port, imap_implicit_tls, smtp_host, smtp_port, smtp_implicit_tls, auth_type, access_token, refresh_token, token_expires_at, password_secret, color, avatar_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email=excluded.email, display_name=excluded.display_name, provider=excluded.provider,
         imap_host=excluded.imap_host, imap_port=excluded.imap_port, imap_implicit_tls=excluded.imap_implicit_tls,
         smtp_host=excluded.smtp_host, smtp_port=excluded.smtp_port, smtp_implicit_tls=excluded.smtp_implicit_tls,
         auth_type=excluded.auth_type, access_token=excluded.access_token, refresh_token=excluded.refresh_token,
         token_expires_at=excluded.token_expires_at, password_secret=excluded.password_secret, color=excluded.color, avatar_data=excluded.avatar_data`,
      [
        acc.id,
        acc.email,
        acc.display_name,
        acc.provider,
        acc.imap_host,
        acc.imap_port,
        acc.imap_implicit_tls ? 1 : 0,
        acc.smtp_host,
        acc.smtp_port,
        acc.smtp_implicit_tls ? 1 : 0,
        acc.auth_type,
        acc.access_token ?? null,
        acc.refresh_token ?? null,
        acc.token_expires_at ?? null,
        acc.password_secret ?? null,
        acc.color,
        acc.avatar_data ?? null,
      ],
    );
  }

  // Restore folders
  for (const folder of data.folders) {
    await dbExecute(
      `INSERT INTO folders (id, account_id, name, path, special_use, unread_count, total_count, sort_order, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, path=excluded.path, special_use=excluded.special_use,
         unread_count=excluded.unread_count, total_count=excluded.total_count, sort_order=excluded.sort_order, color=excluded.color`,
      [
        folder.id,
        folder.account_id,
        folder.name,
        folder.path,
        folder.special_use ?? null,
        folder.unread_count,
        folder.total_count,
        folder.sort_order,
        folder.color ?? null,
      ],
    );
  }

  // Restore messages
  for (const msg of data.messages) {
    await dbExecute(
      `INSERT INTO messages (id, account_id, folder_id, uid, message_id, from_name, from_address, to_json, subject, snippet, body_text, body_html, date, is_read, is_flagged, has_attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         subject=excluded.subject, snippet=excluded.snippet, body_text=excluded.body_text,
         body_html=excluded.body_html, is_read=excluded.is_read, is_flagged=excluded.is_flagged`,
      [
        msg.id,
        msg.account_id,
        msg.folder_id,
        msg.uid,
        msg.message_id ?? null,
        msg.from_name ?? null,
        msg.from_address ?? null,
        msg.to_json,
        msg.subject,
        msg.snippet ?? null,
        msg.body_text ?? null,
        msg.body_html ?? null,
        msg.date,
        msg.is_read,
        msg.is_flagged,
        msg.has_attachments,
      ],
    );
  }

  // Restore rules
  for (const rule of data.rules || []) {
    await dbExecute(
      `INSERT INTO rules (id, account_id, name, enabled, sort_order, match_type, conditions_json, actions_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, enabled=excluded.enabled, sort_order=excluded.sort_order,
         match_type=excluded.match_type, conditions_json=excluded.conditions_json, actions_json=excluded.actions_json`,
      [
        rule.id,
        rule.account_id,
        rule.name,
        rule.enabled,
        rule.sort_order,
        rule.match_type,
        rule.conditions_json,
        rule.actions_json,
      ],
    );
  }

  // Restore templates
  for (const tpl of data.templates || []) {
    await dbExecute(
      `INSERT INTO templates (id, account_id, name, subject, body_html, body_text, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, subject=excluded.subject, body_html=excluded.body_html, body_text=excluded.body_text, sort_order=excluded.sort_order`,
      [tpl.id, tpl.account_id, tpl.name, tpl.subject, tpl.body_html, tpl.body_text ?? "", tpl.sort_order ?? 0],
    );
  }

  // Restore signatures
  for (const sig of data.signatures || []) {
    await dbExecute(
      `INSERT INTO signatures (id, account_id, name, content_html, content_text, is_default)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, content_html=excluded.content_html, content_text=excluded.content_text, is_default=excluded.is_default`,
      [sig.id, sig.account_id, sig.name, sig.content_html, sig.content_text ?? "", sig.is_default],
    );
  }

  // Restore settings
  for (const setItem of data.settings || []) {
    await dbExecute(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [setItem.key, setItem.value],
    );
  }

  // Trigger store hydrations to reflect changes in UI immediately
  await useAccountStore.getState().hydrate();
  const activeAccount = useAccountStore.getState().activeAccount();
  if (activeAccount) {
    await useMailStore.getState().loadFolders(activeAccount);
  }

  return {
    success: true,
    filePath,
    accountsCount: data.accounts.length,
    foldersCount: data.folders.length,
    messagesCount: data.messages.length,
    rulesCount: (data.rules || []).length,
    templatesCount: (data.templates || []).length,
    signaturesCount: (data.signatures || []).length,
  };
}
