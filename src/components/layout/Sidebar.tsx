import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Archive,
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
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { FolderModal } from "@/components/layout/FolderModal";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useUiStore } from "@/store/useUiStore";
import { useT } from "@/lib/useT";
import { buildNotchClipPath, NOTCH_BUBBLE_SIZE } from "@/lib/notchPath";
import type { FolderRow, SpecialUse } from "@/types/mail";

function folderLabel(t: ReturnType<typeof useT>, folder: FolderRow): string {
  return folder.special_use ? t(`folder.${folder.special_use}`) : folder.name;
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

const NOTCH_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const BUBBLE_RADIUS = NOTCH_BUBBLE_SIZE / 2;

interface NotchState {
  clipPath: string;
  bubbleLeft: number;
  bubbleTop: number;
  BubbleIcon: LucideIcon;
}

export function Sidebar() {
  const t = useT();
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

  const asideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [notch, setNotch] = useState<NotchState | null>(null);
  const notchRafRef = useRef<number | null>(null);

  function recomputeNotch() {
    const asideEl = asideRef.current;
    const selected = selectedFolderId ? itemRefs.current.get(selectedFolderId) : undefined;
    if (!asideEl || !selected) {
      setNotch(null);
      return;
    }
    const asideRect = asideEl.getBoundingClientRect();
    const buttonRect = selected.getBoundingClientRect();
    const centerY = buttonRect.top + buttonRect.height / 2 - asideRect.top;
    const folder = folders.find((f) => f.id === selectedFolderId);
    const BubbleIcon = (folder?.special_use && folderIcons[folder.special_use]) || Folder;

    setNotch({
      clipPath: buildNotchClipPath(asideRect.width, asideRect.height, centerY),
      bubbleLeft: asideRect.right - BUBBLE_RADIUS,
      bubbleTop: buttonRect.top + buttonRect.height / 2 - BUBBLE_RADIUS,
      BubbleIcon,
    });
  }

  function scheduleRecomputeNotch() {
    if (notchRafRef.current) return;
    notchRafRef.current = requestAnimationFrame(() => {
      notchRafRef.current = null;
      recomputeNotch();
    });
  }

  useLayoutEffect(() => {
    recomputeNotch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId, folders]);

  useEffect(() => {
    const asideEl = asideRef.current;
    const navEl = navRef.current;
    if (!asideEl) return;

    const observer = new ResizeObserver(() => scheduleRecomputeNotch());
    observer.observe(asideEl);

    window.addEventListener("resize", scheduleRecomputeNotch);
    navEl?.addEventListener("scroll", scheduleRecomputeNotch, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleRecomputeNotch);
      navEl?.removeEventListener("scroll", scheduleRecomputeNotch);
      if (notchRafRef.current) cancelAnimationFrame(notchRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside
      ref={asideRef}
      className="glass-panel relative flex w-60 flex-shrink-0 flex-col rounded-none border-y-0 border-l-0 p-3"
      style={notch ? { clipPath: notch.clipPath, transition: `clip-path 320ms ${NOTCH_EASE}` } : undefined}
    >
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
              {activeAccount?.display_name ?? t("sidebar.noAccount")}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={() => openCompose()}
        className="mb-4 flex h-9 items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
      >
        <Pencil size={14} strokeWidth={1.5} />
        {t("sidebar.compose")}
      </button>

      <nav ref={navRef} className="flex-1 space-y-0.5 overflow-y-auto">
        {folders.map((folder) => {
          const Icon = (folder.special_use && folderIcons[folder.special_use]) || Folder;
          const isSelected = folder.id === selectedFolderId;
          return (
            <button
              key={folder.id}
              ref={(el) => {
                if (el) itemRefs.current.set(folder.id, el);
                else itemRefs.current.delete(folder.id);
              }}
              onClick={() => handleSelectFolder(folder)}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                isSelected
                  ? "text-accent font-medium"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10",
              )}
            >
              <Icon
                size={15}
                strokeWidth={1.5}
                className={clsx("flex-shrink-0 transition-opacity", isSelected && "opacity-0")}
              />
              <span className="flex-1 truncate">{folderLabel(t, folder)}</span>
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
          {t("sidebar.newFolder")}
        </button>
      </nav>

      <button
        onClick={() => openSettings("accounts")}
        className="mt-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10 dark:text-neutral-400"
      >
        <Settings size={15} strokeWidth={1.5} />
        {t("sidebar.settings")}
      </button>

      <FolderModal />

      {notch &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-30 flex items-center justify-center rounded-full bg-accent text-white shadow-glass-lg"
            style={{
              left: notch.bubbleLeft,
              top: notch.bubbleTop,
              width: NOTCH_BUBBLE_SIZE,
              height: NOTCH_BUBBLE_SIZE,
              transition: `left 320ms ${NOTCH_EASE}, top 320ms ${NOTCH_EASE}`,
            }}
          >
            <notch.BubbleIcon size={19} strokeWidth={1.75} />
          </div>,
          document.body,
        )}
    </aside>
  );
}
