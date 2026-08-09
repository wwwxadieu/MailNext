import { useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FilePenLine,
  Folder,
  Inbox,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { FolderContextMenu } from "@/components/layout/FolderContextMenu";
import { FolderModal } from "@/components/layout/FolderModal";
import { ProfileModal } from "@/components/layout/ProfileModal";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useUiStore } from "@/store/useUiStore";
import { useT } from "@/lib/useT";
import type { FolderRow, SpecialUse } from "@/types/mail";

function folderLabel(t: ReturnType<typeof useT>, folder: FolderRow): string {
  if (folder.special_use) return t(`folder.${folder.special_use}`);
  // Translate standard vietnamese folder names if applicable
  const lower = folder.name.toLowerCase();
  if (lower === "inbox" || lower === "hộp thư đến") return t("folder.inbox") ?? "Hộp thư đến";
  if (lower === "sent" || lower === "thư đã gửi") return t("folder.sent") ?? "Thư đã gửi";
  if (lower === "drafts" || lower === "nháp" || lower === "bản thảo" || lower === "thư nháp") return t("folder.drafts") ?? "Thư nháp";
  if (lower === "trash" || lower === "thùng rác") return t("folder.trash") ?? "Thùng rác";
  if (lower === "junk" || lower === "spam" || lower === "thư rác") return t("folder.junk") ?? "Thư rác";
  return folder.name;
}

const folderIcons: Record<SpecialUse, LucideIcon> = {
  inbox: Inbox,
  sent: Send,
  drafts: FilePenLine,
  trash: Trash2,
  junk: ShieldAlert,
  archive: Archive,
  promotions: Megaphone,
  social: Users,
  shopping: ShoppingBag,
};

const SYSTEM_SPECIAL_USES: SpecialUse[] = ["inbox", "drafts", "sent", "archive", "junk", "trash"];
const CATEGORY_SPECIAL_USES: SpecialUse[] = ["promotions", "social", "shopping"];

export function Sidebar() {
  const t = useT();
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
  const activeAccount = useAccountStore((s) => s.activeAccount());

  const folders = useMailStore((s) => s.folders);
  const selectedFolderId = useMailStore((s) => s.selectedFolderId);
  const selectFolder = useMailStore((s) => s.selectFolder);
  const loadMessages = useMailStore((s) => s.loadMessages);
  const setFolderColor = useMailStore((s) => s.setFolderColor);
  const markAllFolderRead = useMailStore((s) => s.markAllFolderRead);

  const isComposing = useUiStore((s) => s.isComposing);
  const openSettings = useUiStore((s) => s.openSettings);
  const openCompose = useUiStore((s) => s.openCompose);
  const openFolderModal = useUiStore((s) => s.openFolderModal);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [systemCollapsed, setSystemCollapsed] = useState(false);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);
  const [customCollapsed, setCustomCollapsed] = useState(false);

  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number;
    y: number;
    folder: FolderRow;
  } | null>(null);

  function handleSelectFolder(folder: FolderRow) {
    selectFolder(folder.id);
    if (activeAccount) void loadMessages(activeAccount, folder);
  }

  // Deduplicate and categorize folders into prioritized sections
  const systemMap = new Map<SpecialUse, FolderRow>();
  const categoryMap = new Map<SpecialUse, FolderRow>();
  const customMap = new Map<string, FolderRow>();

  function detectSpecialUse(folder: FolderRow): SpecialUse | null {
    if (folder.special_use) return folder.special_use;
    const lower = folder.name.trim().toLowerCase();
    if (lower === "hộp thư đến" || lower === "inbox") return "inbox";
    if (lower.includes("nháp") || lower === "bản thảo" || lower === "drafts" || lower === "thư nháp") return "drafts";
    if (lower.includes("đã gửi") || lower === "sent" || lower === "sent mail" || lower === "hộp thư đi") return "sent";
    if (lower.includes("thùng rác") || lower === "trash" || lower === "deleted") return "trash";
    if (lower.includes("thư rác") || lower === "junk" || lower === "spam") return "junk";
    if (lower.includes("lưu trữ") || lower === "archive") return "archive";
    if (lower === "promotions" || lower === "quảng cáo") return "promotions";
    if (lower === "social" || lower === "mạng xã hội") return "social";
    if (lower === "shopping" || lower === "mua sắm") return "shopping";
    return null;
  }

  for (const folder of folders) {
    const role = detectSpecialUse(folder);
    if (role && SYSTEM_SPECIAL_USES.includes(role)) {
      const existing = systemMap.get(role);
      if (!existing) {
        systemMap.set(role, { ...folder, special_use: role });
      } else {
        systemMap.set(role, {
          ...existing,
          unread_count: Math.max(existing.unread_count, folder.unread_count),
        });
      }
    } else if (role && CATEGORY_SPECIAL_USES.includes(role)) {
      const existing = categoryMap.get(role);
      if (!existing) {
        categoryMap.set(role, { ...folder, special_use: role });
      } else {
        categoryMap.set(role, {
          ...existing,
          unread_count: Math.max(existing.unread_count, folder.unread_count),
        });
      }
    } else {
      const normKey = folder.name.trim().toLowerCase();
      const existing = customMap.get(normKey);
      if (!existing) {
        customMap.set(normKey, folder);
      } else {
        customMap.set(normKey, {
          ...existing,
          unread_count: Math.max(existing.unread_count, folder.unread_count),
        });
      }
    }
  }

  const systemPriorityOrder: Record<SpecialUse, number> = {
    inbox: 0,
    drafts: 1,
    sent: 2,
    archive: 3,
    junk: 4,
    trash: 5,
    promotions: 6,
    social: 7,
    shopping: 8,
  };

  const systemFolders = Array.from(systemMap.values()).sort(
    (a, b) => (systemPriorityOrder[a.special_use!] ?? 99) - (systemPriorityOrder[b.special_use!] ?? 99),
  );
  const categoryFolders = Array.from(categoryMap.values());
  const customFolders = Array.from(customMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  return (
    <aside className="glass-panel relative flex h-full w-60 min-h-0 flex-shrink-0 flex-col border-r border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/85 backdrop-blur-2xl backdrop-saturate-150 p-3 shadow-lg z-10 transition-all duration-300">
      {/* Account Profile Header */}
      <div className="relative mb-3">
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-xl bg-black/5 dark:bg-white/5 p-2 text-left transition-all hover:bg-black/10 dark:hover:bg-white/10 group"
          title={t("profile.editTitle") ?? "Chỉnh sửa hồ sơ"}
        >
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-xs text-white shadow-sm transition-transform group-hover:scale-105"
            style={{ backgroundColor: activeAccount?.color ?? "#0A84FF" }}
          >
            {activeAccount?.avatar_data ? (
              <img src={activeAccount.avatar_data} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span>{activeAccount?.display_name?.[0]?.toUpperCase() || <User size={16} />}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-neutral-800 dark:text-neutral-100 group-hover:text-accent transition-colors">
              {activeAccount?.display_name ?? t("sidebar.noAccount")}
            </span>
            <span className="block truncate text-[11px] text-neutral-400 font-normal">
              {activeAccount?.email}
            </span>
          </div>
        </button>

        {accounts.length > 1 && (
          <button
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="absolute right-2 top-2.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <ChevronDown size={14} />
          </button>
        )}

        {accountMenuOpen && accounts.length > 1 && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setAccountMenuOpen(false)} />
            <div className="glass-panel-elevated absolute left-0 right-0 top-12 z-30 space-y-1 rounded-xl p-1.5 shadow-xl">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    setActiveAccount(account.id);
                    setAccountMenuOpen(false);
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                    account.id === activeAccountId
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10",
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: account.color }} />
                  <span className="truncate flex-1">{account.display_name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Animated Compose Quick Button */}
      <button
        onClick={() => openCompose()}
        className={clsx(
          "mb-4 flex h-9.5 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-white shadow-md transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent/40",
          isComposing
            ? "bg-accent-hover scale-[1.02] shadow-accent/20 shadow-lg ring-2 ring-accent/50"
            : "bg-accent hover:bg-accent-hover hover:scale-[1.02] hover:shadow-lg",
        )}
      >
        <Pencil size={15} strokeWidth={2} className={clsx("transition-transform duration-300", isComposing && "rotate-12")} />
        <span>{t("sidebar.compose")}</span>
      </button>

      {/* Categorized Nav Folders */}
      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* Group 1: System Mailboxes */}
        <div>
          <button
            onClick={() => setSystemCollapsed((v) => !v)}
            className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-bold tracking-wider text-neutral-400 uppercase hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <span>{t("sidebar.hoptu") ?? "HỘP THƯ CHÍNH"}</span>
            {systemCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          {!systemCollapsed && (
            <div className="space-y-0.5">
              {systemFolders.map((folder) => {
                const Icon = (folder.special_use && folderIcons[folder.special_use]) || Folder;
                const isSelected = folder.id === selectedFolderId;
                return (
                  <button
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition-all duration-150",
                      isSelected
                        ? "bg-accent text-white font-medium shadow-sm shadow-accent/30"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10",
                    )}
                  >
                    <Icon
                      size={15}
                      strokeWidth={isSelected ? 2 : 1.5}
                      className="flex-shrink-0"
                      style={!isSelected && folder.color ? { color: folder.color } : undefined}
                    />
                    <span className="flex-1 truncate">{folderLabel(t, folder)}</span>
                    {folder.unread_count > 0 && (
                      <span
                        className={clsx(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          isSelected ? "bg-white/25 text-white" : "bg-accent/15 text-accent dark:bg-accent/25 dark:text-accent-hover",
                        )}
                      >
                        {folder.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Group 2: Categories */}
        {categoryFolders.length > 0 && (
          <div>
            <button
              onClick={() => setCategoriesCollapsed((v) => !v)}
              className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-bold tracking-wider text-neutral-400 uppercase hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <span>{t("sidebar.phanloai") ?? "PHÂN LOẠI"}</span>
              {categoriesCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
            {!categoriesCollapsed && (
              <div className="space-y-0.5">
                {categoryFolders.map((folder) => {
                  const Icon = (folder.special_use && folderIcons[folder.special_use]) || Folder;
                  const isSelected = folder.id === selectedFolderId;
                  return (
                    <button
                      key={folder.id}
                      onClick={() => handleSelectFolder(folder)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
                      }}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition-all duration-150",
                        isSelected
                          ? "bg-accent text-white font-medium shadow-sm shadow-accent/30"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10",
                      )}
                    >
                      <Icon
                        size={15}
                        strokeWidth={isSelected ? 2 : 1.5}
                        className="flex-shrink-0"
                        style={!isSelected && folder.color ? { color: folder.color } : undefined}
                      />
                      <span className="flex-1 truncate">{folderLabel(t, folder)}</span>
                      {folder.unread_count > 0 && (
                        <span
                          className={clsx(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                            isSelected ? "bg-white/25 text-white" : "bg-black/10 dark:bg-white/10 text-neutral-600 dark:text-neutral-300",
                          )}
                        >
                          {folder.unread_count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Group 3: Custom User Folders */}
        <div>
          <button
            onClick={() => setCustomCollapsed((v) => !v)}
            className="mb-1 flex w-full items-center justify-between px-2 text-[10px] font-bold tracking-wider text-neutral-400 uppercase hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <span>{t("sidebar.thumuc") ?? "THƯ MỤC CÁ NHÂN"}</span>
            {customCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          {!customCollapsed && (
            <div className="space-y-0.5">
              {customFolders.map((folder) => {
                const isSelected = folder.id === selectedFolderId;
                return (
                  <button
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition-all duration-150",
                      isSelected
                        ? "bg-accent text-white font-medium shadow-sm shadow-accent/30"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10",
                    )}
                  >
                    {folder.color ? (
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-sm"
                        style={{ backgroundColor: folder.color }}
                      />
                    ) : (
                      <Folder size={15} strokeWidth={isSelected ? 2 : 1.5} className="flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{folderLabel(t, folder)}</span>
                    {folder.unread_count > 0 && (
                      <span
                        className={clsx(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          isSelected ? "bg-white/25 text-white" : "bg-black/10 dark:bg-white/10 text-neutral-600 dark:text-neutral-300",
                        )}
                      >
                        {folder.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                onClick={openFolderModal}
                className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[13px] text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
              >
                <Plus size={15} strokeWidth={1.5} />
                {t("sidebar.newFolder")}
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Settings Bottom Button */}
      <button
        onClick={() => openSettings("accounts")}
        className="mt-3 flex flex-shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors"
      >
        <Settings size={15} strokeWidth={1.5} />
        {t("sidebar.settings")}
      </button>

      <FolderModal />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />

      {folderContextMenu && (
        <FolderContextMenu
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          folder={folderContextMenu.folder}
          onClose={() => setFolderContextMenu(null)}
          onSetColor={(color) => void setFolderColor(folderContextMenu.folder.id, color)}
          onMarkAllRead={() => void markAllFolderRead(folderContextMenu.folder)}
          onDeleteFolder={openFolderModal}
        />
      )}
    </aside>
  );
}
