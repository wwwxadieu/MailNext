import { useEffect } from "react";
import {
  Archive,
  FilePenLine,
  Folder,
  Inbox,
  Pencil,
  Plus,
  Send,
  Settings,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { FolderModal } from "@/components/layout/FolderModal";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useUiStore } from "@/store/useUiStore";
import type { FolderRow, SpecialUse } from "@/types/mail";

const folderIcons: Record<SpecialUse, LucideIcon> = {
  inbox: Inbox,
  sent: Send,
  drafts: FilePenLine,
  trash: Trash2,
  junk: ShieldAlert,
  archive: Archive,
};

export function Sidebar() {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
  const activeAccount = useAccountStore((s) => s.activeAccount());

  const folders = useMailStore((s) => s.folders);
  const selectedFolderId = useMailStore((s) => s.selectedFolderId);
  const loadFolders = useMailStore((s) => s.loadFolders);
  const selectFolder = useMailStore((s) => s.selectFolder);
  const loadMessages = useMailStore((s) => s.loadMessages);

  const openSettings = useUiStore((s) => s.openSettings);
  const openCompose = useUiStore((s) => s.openCompose);
  const openFolderModal = useUiStore((s) => s.openFolderModal);

  useEffect(() => {
    if (activeAccount) void loadFolders(activeAccount);
  }, [activeAccount?.id]);

  function handleSelectFolder(folder: FolderRow) {
    selectFolder(folder.id);
    if (activeAccount) void loadMessages(activeAccount, folder);
  }

  return (
    <aside className="glass-panel flex w-60 flex-shrink-0 flex-col rounded-none border-y-0 border-l-0 p-3">
      <div className="mb-3 flex flex-col gap-0.5">
        {accounts.length > 1 ? (
          accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setActiveAccount(account.id)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors",
                account.id === activeAccountId ? "bg-accent/10" : "hover:bg-black/5 dark:hover:bg-white/10",
              )}
            >
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: account.color }} />
              <span className="min-w-0 flex-1">
                <span
                  className={clsx(
                    "block truncate text-sm font-medium",
                    account.id === activeAccountId ? "text-accent" : "text-neutral-800 dark:text-neutral-100",
                  )}
                >
                  {account.display_name}
                </span>
                <span className="block truncate text-[11px] text-neutral-400">{account.email}</span>
              </span>
            </button>
          ))
        ) : (
          <div className="flex items-center gap-2 rounded-xl px-2 py-2">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: activeAccount?.color ?? "#0A84FF" }}
            />
            <span className="flex-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {activeAccount?.display_name ?? "No account"}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={() => openCompose()}
        className="mb-4 flex h-9 items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
      >
        <Pencil size={14} strokeWidth={1.5} />
        Compose
      </button>

      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {folders.map((folder) => {
          const Icon = (folder.special_use && folderIcons[folder.special_use]) || Folder;
          return (
            <button
              key={folder.id}
              onClick={() => handleSelectFolder(folder)}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                folder.id === selectedFolderId
                  ? "bg-accent/12 text-accent font-medium"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10",
              )}
            >
              <Icon size={15} strokeWidth={1.5} className="flex-shrink-0" />
              <span className="flex-1 truncate">{folder.name}</span>
              {folder.unread_count > 0 && (
                <span className="rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-neutral-600 dark:text-neutral-300">
                  {folder.unread_count}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={openFolderModal}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <Plus size={15} strokeWidth={1.5} />
          New folder
        </button>
      </nav>

      <button
        onClick={() => openSettings("accounts")}
        className="mt-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10 dark:text-neutral-400"
      >
        <Settings size={15} strokeWidth={1.5} />
        Settings
      </button>

      <FolderModal />
    </aside>
  );
}
