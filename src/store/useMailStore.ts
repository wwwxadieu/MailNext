import { create } from "zustand";
import * as commands from "@/lib/commands";
import { toImapConnection } from "@/lib/connection";
import * as repo from "@/lib/repository";
import { applyRulesToNewMessages } from "@/lib/rules";
import { ensureDefaultCategoryFolders } from "@/lib/categoryFolders";
import type { Account, FolderRow, MessageRow } from "@/types/mail";

interface MailState {
  folders: FolderRow[];
  messages: MessageRow[];
  selectedFolderId: string | null;
  selectedMessageId: string | null;
  isLoadingFolders: boolean;
  isLoadingMessages: boolean;
  error: string | null;

  loadFolders: (account: Account) => Promise<void>;
  selectFolder: (folderId: string) => void;
  loadMessages: (account: Account, folder: FolderRow) => Promise<void>;
  selectMessage: (messageId: string | null) => void;
  markRead: (account: Account, folder: FolderRow, message: MessageRow, isRead: boolean) => Promise<void>;
  toggleFlag: (account: Account, folder: FolderRow, message: MessageRow) => Promise<void>;
}

// Guards `loadFolders` against overlapping calls for the same account —
// React StrictMode's intentional double-effect in dev, or a user switching
// accounts back and forth before the first call settles. Without this, two
// calls can each finish with a different snapshot of `folders` (one may
// have raced ahead of the other's inserts) and whichever calls `set()`
// last silently wins, even if it's the staler one.
const loadFoldersInFlight = new Set<string>();

export const useMailStore = create<MailState>((set, get) => ({
  folders: [],
  messages: [],
  selectedFolderId: null,
  selectedMessageId: null,
  isLoadingFolders: false,
  isLoadingMessages: false,
  error: null,

  loadFolders: async (account) => {
    if (loadFoldersInFlight.has(account.id)) return;
    loadFoldersInFlight.add(account.id);
    set({ isLoadingFolders: true, error: null });
    try {
      const connection = toImapConnection(account);
      const remoteFolders = await commands.imapListFolders(connection);
      await repo.syncFolders(account.id, remoteFolders);
      let folders = await repo.listFolders(account.id);

      try {
        const provisioned = await ensureDefaultCategoryFolders(account, connection, folders);
        if (provisioned) folders = await repo.listFolders(account.id);
      } catch {
        // Best-effort — the account still works fine without the default categories.
      }

      set({ folders, isLoadingFolders: false });

      const inbox = folders.find((f) => f.special_use === "inbox") ?? folders[0];
      if (inbox && !get().selectedFolderId) {
        get().selectFolder(inbox.id);
        void get().loadMessages(account, inbox);
      }
    } catch (err) {
      set({ isLoadingFolders: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      loadFoldersInFlight.delete(account.id);
    }
  },

  selectFolder: (folderId) => set({ selectedFolderId: folderId, selectedMessageId: null }),

  loadMessages: async (account, folder) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const connection = toImapConnection(account);
      const remoteMessages = await commands.imapFetchMessages(connection, folder.path, 50, 0);

      // Diff against the local cache *before* writing it, so rules only ever
      // see messages this device hasn't processed before — otherwise every
      // sync would re-run rules against the whole folder and could stomp a
      // user's own later edits (e.g. re-flagging something they unflagged).
      const existingUids = await repo.listMessageUids(folder.id);
      const newMessages = remoteMessages.filter((m) => !existingUids.has(m.uid));

      await repo.cacheMessages(account.id, folder.id, remoteMessages);
      if (newMessages.length > 0) {
        await applyRulesToNewMessages(account, folder, get().folders, newMessages);
      }

      const messages = await repo.listMessages(folder.id);
      set({ messages, isLoadingMessages: false });
    } catch (err) {
      // Fall back to whatever is cached locally when the network call fails.
      const messages = await repo.listMessages(folder.id);
      set({ messages, isLoadingMessages: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  selectMessage: (messageId) => set({ selectedMessageId: messageId }),

  markRead: async (account, folder, message, isRead) => {
    await repo.setMessageReadState(message.id, isRead);
    set((state) => ({
      messages: state.messages.map((m) => (m.id === message.id ? { ...m, is_read: isRead ? 1 : 0 } : m)),
    }));
    try {
      const connection = toImapConnection(account);
      await commands.imapSetFlag(connection, folder.path, message.uid, "\\Seen", isRead);
    } catch {
      // Local state already reflects the change; the next sync reconciles it.
    }
  },

  toggleFlag: async (account, folder, message) => {
    const next = message.is_flagged === 1 ? false : true;
    await repo.setMessageFlagged(message.id, next);
    set((state) => ({
      messages: state.messages.map((m) => (m.id === message.id ? { ...m, is_flagged: next ? 1 : 0 } : m)),
    }));
    try {
      const connection = toImapConnection(account);
      await commands.imapSetFlag(connection, folder.path, message.uid, "\\Flagged", next);
    } catch {
      // Local state already reflects the change; the next sync reconciles it.
    }
  },
}));
