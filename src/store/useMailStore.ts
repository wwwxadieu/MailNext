import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import * as commands from "@/lib/commands";
import { toImapConnection } from "@/lib/connection";
import * as repo from "@/lib/repository";
import { applyRulesToNewMessages } from "@/lib/rules";
import { classifyAndFileNewMessages, ensureDefaultCategoryFolders } from "@/lib/categoryFolders";
import type { Account, FolderRow, MessageRow } from "@/types/mail";

export type SyncStage = "idle" | "folders" | "messages";

interface FolderSyncProgress {
  current: number;
  total: number;
}

interface MailState {
  folders: FolderRow[];
  messages: MessageRow[];
  selectedFolderId: string | null;
  selectedMessageId: string | null;
  isLoadingFolders: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  syncStage: SyncStage;
  folderSyncProgress: FolderSyncProgress | null;

  loadFolders: (account: Account) => Promise<void>;
  selectFolder: (folderId: string) => void;
  loadMessages: (account: Account, folder: FolderRow) => Promise<void>;
  selectMessage: (messageId: string | null) => void;
  markRead: (account: Account, folder: FolderRow, message: MessageRow, isRead: boolean) => Promise<void>;
  toggleFlag: (account: Account, folder: FolderRow, message: MessageRow) => Promise<void>;
  moveMessages: (
    account: Account,
    folder: FolderRow,
    messages: MessageRow[],
    destination: FolderRow,
  ) => Promise<void>;
  deleteMessagesPermanently: (account: Account, folder: FolderRow, messages: MessageRow[]) => Promise<void>;
  emptyFolder: (account: Account, folder: FolderRow) => Promise<void>;
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
  syncStage: "idle",
  folderSyncProgress: null,

  loadFolders: async (account) => {
    if (loadFoldersInFlight.has(account.id)) return;
    loadFoldersInFlight.add(account.id);
    set({ isLoadingFolders: true, error: null, syncStage: "folders", folderSyncProgress: null });
    const unlisten = await listen<FolderSyncProgress>("mail://folder-sync-progress", (event) => {
      set({ folderSyncProgress: event.payload });
    });
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
        // Awaited (rather than fire-and-forget) so the "messages" sync stage
        // this sets isn't immediately clobbered by this function's own
        // "idle" reset in `finally` below.
        await get().loadMessages(account, inbox);
      } else {
        set({ syncStage: "idle", folderSyncProgress: null });
      }
    } catch (err) {
      // Fall back to whatever folders are already cached locally — a
      // transient network hiccup (very common right after the app
      // restarts, e.g. right after an update) shouldn't blank out mail
      // the user already had synced. Mirrors the same fallback already
      // in `loadMessages` below.
      const folders = await repo.listFolders(account.id);
      set({
        folders,
        isLoadingFolders: false,
        error: err instanceof Error ? err.message : String(err),
        syncStage: "idle",
        folderSyncProgress: null,
      });

      const inbox = folders.find((f) => f.special_use === "inbox") ?? folders[0];
      if (inbox && !get().selectedFolderId) {
        get().selectFolder(inbox.id);
        await get().loadMessages(account, inbox);
      }
    } finally {
      unlisten();
      loadFoldersInFlight.delete(account.id);
    }
  },

  selectFolder: (folderId) => set({ selectedFolderId: folderId, selectedMessageId: null }),

  loadMessages: async (account, folder) => {
    // Show whatever's already cached immediately so switching folders (or a
    // cold start) doesn't block on the network round-trip below — the fresh
    // fetch below patches `messages` again once it lands.
    const cached = await repo.listMessages(folder.id);
    set({ messages: cached, isLoadingMessages: true, error: null, syncStage: "messages" });
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
        // Built-in category filing (Gmail-style tabs) runs first and is
        // independent of the user's own Rules; anything it already moved
        // out of the inbox is excluded from the Rules pass below so a
        // matching custom rule doesn't try to move it a second time.
        const filed = await classifyAndFileNewMessages(account, folder, get().folders, newMessages);
        const remaining = filed.size > 0 ? newMessages.filter((m) => !filed.has(m.uid)) : newMessages;
        if (remaining.length > 0) {
          await applyRulesToNewMessages(account, folder, get().folders, remaining);
        }
      }

      const messages = await repo.listMessages(folder.id);
      set({ messages, isLoadingMessages: false, syncStage: "idle", folderSyncProgress: null });
    } catch (err) {
      // Fall back to whatever is cached locally when the network call fails.
      const messages = await repo.listMessages(folder.id);
      set({
        messages,
        isLoadingMessages: false,
        error: err instanceof Error ? err.message : String(err),
        syncStage: "idle",
        folderSyncProgress: null,
      });
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

  moveMessages: async (account, folder, messages, destination) => {
    const connection = toImapConnection(account);
    const movedIds = new Set<string>();
    for (const message of messages) {
      try {
        await commands.imapMoveMessage(connection, folder.path, message.uid, destination.path);
        await repo.deleteMessage(message.id);
        movedIds.add(message.id);
      } catch {
        // Leave it in place if the move fails — the next sync reconciles it.
      }
    }
    set((state) => ({
      messages: state.messages.filter((m) => !movedIds.has(m.id)),
      selectedMessageId: movedIds.has(state.selectedMessageId ?? "") ? null : state.selectedMessageId,
    }));
  },

  deleteMessagesPermanently: async (account, folder, messages) => {
    const connection = toImapConnection(account);
    const uids = messages.map((m) => m.uid);
    await commands.imapDeleteMessages(connection, folder.path, uids);
    const deletedIds = new Set(messages.map((m) => m.id));
    for (const id of deletedIds) {
      await repo.deleteMessage(id);
    }
    set((state) => ({
      messages: state.messages.filter((m) => !deletedIds.has(m.id)),
      selectedMessageId: deletedIds.has(state.selectedMessageId ?? "") ? null : state.selectedMessageId,
    }));
  },

  emptyFolder: async (account, folder) => {
    const connection = toImapConnection(account);
    await commands.imapEmptyFolder(connection, folder.path);
    await repo.deleteMessagesByFolder(folder.id);
    if (get().selectedFolderId === folder.id) {
      set({ messages: [], selectedMessageId: null });
    }
  },
}));
