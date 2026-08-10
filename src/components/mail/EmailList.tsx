import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ListFilter,
  Loader2,
  Megaphone,
  Paperclip,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  Star,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useUiStore } from "@/store/useUiStore";
import { useT } from "@/lib/useT";
import { detectMessageCategoryHint } from "@/lib/categoryFolders";
import { SenderAvatar } from "@/components/mail/SenderAvatar";
import { MessageContextMenu } from "@/components/mail/MessageContextMenu";
import type { MessageRow, SpecialUse } from "@/types/mail";

type BadgeCategory = "promotions" | "social" | "shopping" | "junk";

const BADGE_STYLE: Record<BadgeCategory, { icon: LucideIcon; classes: string }> = {
  promotions: { icon: Megaphone, classes: "bg-warning/10 text-warning" },
  social: { icon: Users, classes: "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400" },
  shopping: { icon: ShoppingBag, classes: "bg-accent/10 text-accent" },
  junk: { icon: ShieldAlert, classes: "bg-danger/10 text-danger" },
};

type QuickFilter = "all" | "unread" | "flagged" | "attachments";

interface EmailListProps {
  width?: number;
}

export function EmailList({ width }: EmailListProps = {}) {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const folders = useMailStore((s) => s.folders);
  const selectedFolderId = useMailStore((s) => s.selectedFolderId);
  const messages = useMailStore((s) => s.messages);
  const selectedMessageId = useMailStore((s) => s.selectedMessageId);
  const selectMessage = useMailStore((s) => s.selectMessage);
  const markRead = useMailStore((s) => s.markRead);
  const toggleFlag = useMailStore((s) => s.toggleFlag);
  const moveMessages = useMailStore((s) => s.moveMessages);
  const deleteMessagesPermanently = useMailStore((s) => s.deleteMessagesPermanently);
  const emptyFolder = useMailStore((s) => s.emptyFolder);
  const isLoadingMessages = useMailStore((s) => s.isLoadingMessages);
  const loadFolders = useMailStore((s) => s.loadFolders);
  const loadMessages = useMailStore((s) => s.loadMessages);
  const syncStage = useMailStore((s) => s.syncStage);
  const folderSyncProgress = useMailStore((s) => s.folderSyncProgress);
  const openSettings = useUiStore((s) => s.openSettings);

  type SortOption = "newest" | "oldest" | "unread_first" | "read_first";

  const [query, setQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: MessageRow } | null>(null);

  const folder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const folderNameLower = (folder?.name ?? "").toLowerCase();
  const isTrash = folder?.special_use === "trash" || folderNameLower.includes("thùng rác") || folderNameLower.includes("trash");
  const isJunk = folder?.special_use === "junk" || folderNameLower.includes("thư rác") || folderNameLower.includes("junk") || folderNameLower.includes("spam");
  const canEmptyFolder = isTrash || isJunk;

  async function handleSync() {
    if (!activeAccount || isSyncing) return;
    setIsSyncing(true);
    try {
      await loadFolders(activeAccount);
      const current = useMailStore.getState().folders.find((f) => f.id === selectedFolderId) ?? folder;
      if (current) await loadMessages(activeAccount, current);
    } finally {
      setIsSyncing(false);
    }
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(messageId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  const filtered = useMemo(() => {
    let result = [...messages];
    if (quickFilter === "unread") result = result.filter((m) => m.is_read === 0);
    else if (quickFilter === "flagged") result = result.filter((m) => m.is_flagged === 1);
    else if (quickFilter === "attachments") result = result.filter((m) => m.has_attachments === 1);

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          (m.from_name ?? "").toLowerCase().includes(q) ||
          (m.from_address ?? "").toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q),
      );
    }

    if (sortOption === "newest") {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortOption === "oldest") {
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (sortOption === "unread_first") {
      result.sort((a, b) => a.is_read - b.is_read || new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortOption === "read_first") {
      result.sort((a, b) => b.is_read - a.is_read || new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return result;
  }, [messages, query, quickFilter, sortOption]);

  const isAllSelected = filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id));

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((m) => m.id)));
    }
  }

  /** Deletes messages (moving to Trash or deleting permanently if in Trash/Junk or if trash folder not found) */
  async function deleteTargets(targets: MessageRow[]): Promise<boolean> {
    if (!activeAccount || !folder || targets.length === 0) return false;
    if (isTrash || isJunk) {
      const confirmMsg =
        targets.length === 1
          ? (t("emailList.confirmDeletePermanent") ?? "Xóa vĩnh viễn thư này?")
          : (t("emailList.confirmDeleteSelectedPermanent", { count: targets.length }) ?? `Xóa vĩnh viễn ${targets.length} thư đã chọn?`);
      if (!window.confirm(confirmMsg)) return false;
      await deleteMessagesPermanently(activeAccount, folder, targets);
    } else {
      // Find trash folder by special_use or name
      const trashFolder =
        folders.find((f) => f.special_use === "trash") ||
        folders.find((f) => {
          const fn = f.name.toLowerCase();
          return fn.includes("thùng rác") || fn.includes("trash") || fn.includes("deleted");
        });

      if (trashFolder) {
        await moveMessages(activeAccount, folder, targets, trashFolder);
      } else {
        // Fallback: if no trash folder exists, delete permanently
        await deleteMessagesPermanently(activeAccount, folder, targets);
      }
    }
    return true;
  }

  async function handleEmptyCurrentFolder() {
    if (!activeAccount || !folder) return;
    const folderTitle = isJunk ? "thư rác" : "thùng rác";
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tất cả thư trong ${folderTitle} không?`)) return;
    await emptyFolder(activeAccount, folder);
  }

  async function handleToolbarDelete() {
    if (selectionMode && selectedIds.size > 0) {
      const targets = messages.filter((m) => selectedIds.has(m.id));
      const didDelete = await deleteTargets(targets);
      if (didDelete) exitSelection();
    } else if (selectedMessageId) {
      const target = messages.find((m) => m.id === selectedMessageId);
      if (target) await deleteTargets([target]);
    }
  }

  async function handleSelectionMarkRead() {
    if (!activeAccount || !folder) return;
    const targets = messages.filter((m) => selectedIds.has(m.id));
    for (const target of targets) {
      await markRead(activeAccount, folder, target, true);
    }
  }

  // A junk *hint* is only a loose keyword guess (see categoryFolders.ts), so
  // its suggested action is the reversible "move to Trash" rather than
  // filing straight into Junk the way a confident promo/social/shopping
  // match does.
  function badgeDestinationFolder(category: BadgeCategory) {
    const targetUse: SpecialUse = category === "junk" ? "trash" : category;
    return folders.find((f) => f.special_use === targetUse);
  }

  async function handleBadgeAction(message: MessageRow, category: BadgeCategory) {
    if (!activeAccount || !folder) return;
    const destination = badgeDestinationFolder(category);
    if (!destination) return;
    await moveMessages(activeAccount, folder, [message], destination);
  }

  const syncPercent =
    syncStage === "folders" && folderSyncProgress
      ? Math.min(100, Math.round((folderSyncProgress.current / Math.max(folderSyncProgress.total, 1)) * 100))
      : null;

  const syncLabel =
    syncStage === "folders"
      ? folderSyncProgress
        ? t("emailList.syncingFolders", { current: folderSyncProgress.current, total: folderSyncProgress.total })
        : t("emailList.syncingFoldersGeneric")
      : syncStage === "messages"
        ? t("emailList.syncingMessages")
        : null;

  function handleOpen(message: MessageRow) {
    if (selectionMode) {
      toggleSelected(message.id);
      return;
    }
    selectMessage(message.id);
    if (activeAccount && folder && message.is_read === 0) {
      void markRead(activeAccount, folder, message, true);
    }
  }

  const canToolbarDelete = (selectionMode && selectedIds.size > 0) || (!selectionMode && !!selectedMessageId);

  return (
    <section
      className="solid-panel flex flex-shrink-0 flex-col rounded-none border-y-0"
      style={{ width: width ? `${width}px` : "360px" }}
    >
      <header className="flex flex-shrink-0 flex-col gap-2 border-b border-black/5 dark:border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-xl bg-black/5 dark:bg-white/5 px-2.5 py-1.5 border border-black/5 dark:border-white/5">
          <Search size={14} strokeWidth={1.5} className="text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("emailList.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 flex-1 truncate px-1 text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {folder ? (folder.special_use ? t(`folder.${folder.special_use}`) : folder.name) : t("emailList.selectFolder")}
          </h1>
          <div className="flex flex-shrink-0 items-center gap-0.5">
            {/* Sort Popover Icon Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSortMenuOpen((v) => !v)}
                title={
                  sortOption === "newest"
                    ? "Sắp xếp: Mới nhất trước"
                    : sortOption === "oldest"
                      ? "Sắp xếp: Cũ nhất trước"
                      : sortOption === "unread_first"
                        ? "Sắp xếp: Chưa đọc lên đầu"
                        : "Sắp xếp: Đã đọc lên đầu"
                }
                className={clsx(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  sortOption !== "newest"
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-neutral-400 hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200",
                )}
              >
                <ArrowUpDown size={14} strokeWidth={1.5} />
              </button>

              {sortMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      Sắp xếp thư theo
                    </p>
                    <div className="space-y-0.5">
                      {[
                        { id: "newest", label: "Mới nhất trước" },
                        { id: "oldest", label: "Cũ nhất trước" },
                        { id: "unread_first", label: "🔵 Chưa đọc lên đầu" },
                        { id: "read_first", label: "⚪ Đã đọc lên đầu" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSortOption(opt.id as SortOption);
                            setSortMenuOpen(false);
                          }}
                          className={clsx(
                            "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                            sortOption === opt.id
                              ? "bg-accent/10 text-accent font-medium"
                              : "text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10",
                          )}
                        >
                          <span>{opt.label}</span>
                          {sortOption === opt.id && <Check size={12} className="text-accent" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                if (selectionMode) exitSelection();
                else setSelectionMode(true);
              }}
              title={selectionMode ? "Tắt chế độ chọn" : "Bật chế độ chọn multi-select"}
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                selectionMode ? "bg-accent/15 text-accent" : "text-neutral-400 hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200",
              )}
            >
              <CheckCircle2 size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={handleSync}
              disabled={!activeAccount || isSyncing}
              title={t("emailList.sync")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-neutral-200"
            >
              <RefreshCw size={14} strokeWidth={1.5} className={clsx((isSyncing || syncStage !== "idle") && "animate-spin")} />
            </button>
            <button
              onClick={() => openSettings("labels")}
              title={t("emailList.labels")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
            >
              <Tag size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => openSettings("rules")}
              title={t("emailList.rules")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
            >
              <ListFilter size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => void handleToolbarDelete()}
              disabled={!canToolbarDelete}
              title={t("emailList.delete")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-black/5 hover:text-danger disabled:opacity-40 dark:hover:bg-white/10"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
            {canEmptyFolder && (
              <button
                onClick={() => void handleEmptyCurrentFolder()}
                title="Xóa tất cả thư trong thư mục này"
                className="flex h-7 items-center gap-1 rounded-lg bg-danger/10 px-2 text-[11px] font-semibold text-danger transition-colors hover:bg-danger/20"
              >
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {syncLabel && (
          <div className="flex flex-col gap-1 px-1">
            <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
              <span>{syncLabel}</span>
              {syncPercent !== null && <span className="tabular-nums">{syncPercent}%</span>}
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className={clsx(
                  "h-full rounded-full bg-accent transition-[width] duration-200",
                  syncPercent === null && "w-1/3 animate-pulse",
                )}
                style={syncPercent !== null ? { width: `${syncPercent}%` } : undefined}
              />
            </div>
          </div>
        )}

        {selectionMode ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-accent/10 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:opacity-80 transition-opacity"
              >
                <div
                  className={clsx(
                    "flex h-4 w-4 items-center justify-center rounded-full border transition-all",
                    isAllSelected
                      ? "border-accent bg-accent text-white"
                      : "border-accent/60 bg-transparent",
                  )}
                >
                  {isAllSelected && <Check size={10} strokeWidth={3} />}
                </div>
                <span>{isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}</span>
              </button>
              <span className="text-[11px] text-neutral-500 font-medium">({selectedIds.size})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void handleSelectionMarkRead()}
                disabled={selectedIds.size === 0}
                className="rounded-full px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
              >
                {t("selection.markRead")}
              </button>
              <button
                onClick={() => void handleToolbarDelete()}
                disabled={selectedIds.size === 0}
                className="rounded-full px-2 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10 disabled:opacity-40"
              >
                {t("selection.delete")}
              </button>
              <button
                onClick={exitSelection}
                className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(
              [
                ["all", t("emailList.filterAll")],
                ["unread", t("emailList.filterUnread")],
                ["flagged", t("emailList.filterFlagged")],
                ["attachments", t("emailList.filterAttachments")],
              ] as [QuickFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setQuickFilter(value)}
                className={clsx(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors flex-shrink-0",
                  quickFilter === value
                    ? "bg-accent text-white shadow-sm"
                    : "bg-black/5 text-neutral-500 hover:bg-black/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:bg-white/10",
                )}
              >
                {value === "flagged" && <Star size={10} strokeWidth={2} />}
                {value === "attachments" && <Paperclip size={10} strokeWidth={2} />}
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoadingMessages && messages.length === 0 && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-400">
            <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />
            {t("emailList.loading")}
          </div>
        )}

        {!isLoadingMessages && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 p-10 text-center text-sm text-neutral-400">
            {t("emailList.empty")}
          </div>
        )}

        {filtered.map((message) => {
          const isChecked = selectedIds.has(message.id);
          const categoryHint = detectMessageCategoryHint({
            fromName: message.from_name,
            fromAddress: message.from_address,
            subject: message.subject,
            snippet: message.snippet,
          }) as BadgeCategory | null;
          // Redundant once the message already lives in its matching
          // category folder (e.g. viewing the Promotions folder itself).
          const badge = categoryHint && folder?.special_use !== categoryHint ? categoryHint : null;
          return (
            <button
              key={message.id}
              onClick={() => handleOpen(message)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, message });
              }}
              className={clsx(
                "flex w-full items-start gap-2.5 border-b border-black/5 px-4 py-3 text-left transition-colors dark:border-white/5",
                message.id === selectedMessageId || isChecked
                  ? "bg-accent/10 dark:bg-accent/15"
                  : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
              )}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectionMode) setSelectionMode(true);
                  toggleSelected(message.id);
                }}
                className="flex flex-shrink-0 items-center justify-center cursor-pointer group/avatar relative"
                title="Click để chọn email này"
              >
                {selectionMode ? (
                  <div
                    className={clsx(
                      "flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200 mt-0.5",
                      isChecked
                        ? "border-accent bg-accent text-white shadow-sm ring-2 ring-accent/30 scale-105"
                        : "border-neutral-300 dark:border-neutral-600 bg-black/5 dark:bg-white/10 hover:border-accent/60",
                    )}
                  >
                    {isChecked && <Check size={12} strokeWidth={3} />}
                  </div>
                ) : (
                  <div className="relative mt-0.5">
                    <SenderAvatar name={message.from_name} address={message.from_address} size={28} className="transition-transform group-hover/avatar:scale-110" />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={clsx(
                      "truncate text-[13px]",
                      message.is_read === 0
                        ? "font-semibold text-neutral-900 dark:text-neutral-50"
                        : "font-medium text-neutral-600 dark:text-neutral-300",
                    )}
                  >
                    {message.from_name || message.from_address || t("app.unknownSender")}
                  </span>
                  <span className="flex-shrink-0 text-[11px] text-neutral-400 tabular-nums">
                    {safeDistance(message.date)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {message.is_read === 0 && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />}
                  <span
                    className={clsx(
                      "truncate text-[13px]",
                      message.is_read === 0
                        ? "text-neutral-800 dark:text-neutral-100 font-medium"
                        : "text-neutral-500 dark:text-neutral-400",
                    )}
                  >
                    {message.subject}
                  </span>
                </div>
                {badge && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleBadgeAction(message, badge);
                    }}
                    title={t(`emailList.badge.${badge}Action`)}
                    className={clsx(
                      "flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-75",
                      BADGE_STYLE[badge].classes,
                    )}
                  >
                    {(() => {
                      const Icon = BADGE_STYLE[badge].icon;
                      return <Icon size={10} strokeWidth={2} />;
                    })()}
                    {t(`emailList.badge.${badge}`)}
                  </button>
                )}
                <p className="truncate text-[12px] text-neutral-400">{message.snippet}</p>
              </div>
            </button>
          );
        })}
      </div>

      {contextMenu && activeAccount && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          message={contextMenu.message}
          accountId={activeAccount.id}
          onClose={() => setContextMenu(null)}
          onToggleRead={() => {
            if (activeAccount && folder) void markRead(activeAccount, folder, contextMenu.message, contextMenu.message.is_read === 0);
          }}
          onToggleFlag={() => {
            if (activeAccount && folder) void toggleFlag(activeAccount, folder, contextMenu.message);
          }}
          onSelect={() => {
            setSelectionMode(true);
            setSelectedIds(new Set([contextMenu.message.id]));
          }}
          onDelete={() => void deleteTargets([contextMenu.message])}
          onManageLabels={() => openSettings("labels")}
        />
      )}
    </section>
  );
}

function safeDistance(date: string): string {
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: false });
  } catch {
    return "";
  }
}
