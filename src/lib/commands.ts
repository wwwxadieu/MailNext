import { invoke } from "@tauri-apps/api/core";
import type {
  EmailMessage,
  FolderInfo,
  ImapConnection,
  OAuthTokenResult,
  OutgoingMessage,
  Provider,
  ProviderDefaults,
  SmtpConnection,
} from "@/types/mail";

export function getProviderDefaults(provider: Provider): Promise<ProviderDefaults> {
  return invoke("get_provider_defaults", { provider });
}

export function oauthAuthorize(provider: Provider): Promise<OAuthTokenResult> {
  return invoke("oauth_authorize", { provider });
}

export function oauthRefresh(provider: Provider, refreshToken: string): Promise<OAuthTokenResult> {
  return invoke("oauth_refresh", { provider, refreshToken });
}

export function imapTestConnection(connection: ImapConnection): Promise<boolean> {
  return invoke("imap_test_connection", { connection });
}

export function imapListFolders(connection: ImapConnection): Promise<FolderInfo[]> {
  return invoke("imap_list_folders", { connection });
}

export function imapCreateFolder(connection: ImapConnection, path: string): Promise<void> {
  return invoke("imap_create_folder", { connection, path });
}

export function imapDeleteFolder(connection: ImapConnection, path: string): Promise<void> {
  return invoke("imap_delete_folder", { connection, path });
}

export function imapFetchMessages(
  connection: ImapConnection,
  folder: string,
  limit: number,
  offset: number,
): Promise<EmailMessage[]> {
  return invoke("imap_fetch_messages", { connection, folder, limit, offset });
}

export function imapSetFlag(
  connection: ImapConnection,
  folder: string,
  uid: number,
  flag: "\\Seen" | "\\Flagged" | "\\Deleted",
  value: boolean,
): Promise<void> {
  return invoke("imap_set_flag", { connection, folder, uid, flag, value });
}

export function imapMoveMessage(
  connection: ImapConnection,
  folder: string,
  uid: number,
  destination: string,
): Promise<void> {
  return invoke("imap_move_message", { connection, folder, uid, destination });
}

export function imapUnseenCount(connection: ImapConnection, folder: string): Promise<number> {
  return invoke("imap_unseen_count", { connection, folder });
}

export function smtpTestConnection(connection: SmtpConnection): Promise<boolean> {
  return invoke("smtp_test_connection", { connection });
}

export function smtpSend(connection: SmtpConnection, message: OutgoingMessage): Promise<string> {
  return invoke("smtp_send", { connection, message });
}

export function notifyNewMail(title: string, body: string): Promise<void> {
  return invoke("notify_new_mail", { title, body });
}

export function startMailWatcher(
  accountEmail: string,
  connection: ImapConnection,
  folder: string,
  intervalSecs: number,
): Promise<void> {
  return invoke("start_mail_watcher", { accountEmail, connection, folder, intervalSecs });
}

export function stopMailWatcher(accountEmail: string, folder: string): Promise<void> {
  return invoke("stop_mail_watcher", { accountEmail, folder });
}
