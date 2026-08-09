import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { buildNotchClipPath, NOTCH_BUBBLE_SIZE, NOTCH_DEPTH, NOTCH_HALF_HEIGHT } from "@/lib/notchPath";
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

const BUBBLE_RADIUS = NOTCH_BUBBLE_SIZE / 2;
const GLOW_SIZE = NOTCH_BUBBLE_SIZE + 40;

// Spring tuning: stiffness/damping drive the chase toward the target row; the
// velocity-derived stretch factors are what give the notch + bubble a liquid,
// elastic quality instead of a shape sliding to a new spot on a fixed easing curve.
const STIFFNESS = 300;
const DAMPING = 22;
const HEIGHT_STRETCH_PER_VELOCITY = 1 / 1400;
const MAX_HEIGHT_STRETCH = 0.65;
const DEPTH_STRETCH_PER_VELOCITY = 1 / 2200;
const MAX_DEPTH_STRETCH = 0.35;
const BUBBLE_SQUASH_PER_VELOCITY = 1 / 5200;
const MAX_BUBBLE_SQUASH = 0.22;

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
  const bubbleRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [ActiveIcon, setActiveIcon] = useState<LucideIcon>(() => Folder);

  const asideBoxRef = useRef({ width: 0, height: 0, top: 0, right: 0 });
  const targetYRef = useRef<number | null>(null);
  const posYRef = useRef<number | null>(null);
  const velYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  function applyFrame() {
    const asideEl = asideRef.current;
    const bubbleEl = bubbleRef.current;
    const glowEl = glowRef.current;
    const posY = posYRef.current;
    if (!asideEl || posY === null) return;

    const speed = Math.abs(velYRef.current);
    const heightStretch = 1 + Math.min(speed * HEIGHT_STRETCH_PER_VELOCITY, MAX_HEIGHT_STRETCH);
    const depthStretch = 1 + Math.min(speed * DEPTH_STRETCH_PER_VELOCITY, MAX_DEPTH_STRETCH);
    const squash = Math.min(speed * BUBBLE_SQUASH_PER_VELOCITY, MAX_BUBBLE_SQUASH);

    const box = asideBoxRef.current;
    asideEl.style.clipPath = buildNotchClipPath(
      box.width,
      box.height,
      posY,
      NOTCH_HALF_HEIGHT * heightStretch,
      NOTCH_DEPTH * depthStretch,
    );

    const absoluteY = box.top + posY;
    if (bubbleEl) {
      bubbleEl.style.left = `${box.right - BUBBLE_RADIUS}px`;
      bubbleEl.style.top = `${absoluteY - BUBBLE_RADIUS}px`;
      bubbleEl.style.transform = `scaleY(${1 + squash}) scaleX(${1 - squash * 0.6})`;
    }
    if (glowEl) {
      glowEl.style.left = `${box.right - BUBBLE_RADIUS - (GLOW_SIZE - NOTCH_BUBBLE_SIZE) / 2}px`;
      glowEl.style.top = `${absoluteY - BUBBLE_RADIUS - (GLOW_SIZE - NOTCH_BUBBLE_SIZE) / 2}px`;
    }
  }

  function stepSpring(now: number, last: number) {
    const target = targetYRef.current;
    if (target === null || posYRef.current === null) {
      rafRef.current = null;
      return;
    }
    const dt = Math.min((now - last) / 1000, 1 / 30);

    const dY = target - posYRef.current;
    const acc = dY * STIFFNESS - velYRef.current * DAMPING;
    velYRef.current += acc * dt;
    posYRef.current += velYRef.current * dt;

    applyFrame();

    const settled = Math.abs(dY) < 0.3 && Math.abs(velYRef.current) < 0.3;
    if (settled) {
      posYRef.current = target;
      velYRef.current = 0;
      applyFrame();
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame((n) => stepSpring(n, now));
  }

  function startSpring() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame((n) => stepSpring(n, n));
  }

  function recomputeTarget() {
    const asideEl = asideRef.current;
    const selected = selectedFolderId ? itemRefs.current.get(selectedFolderId) : undefined;
    if (!asideEl || !selected) {
      targetYRef.current = null;
      posYRef.current = null;
      setBubbleVisible(false);
      return;
    }

    const asideRect = asideEl.getBoundingClientRect();
    const buttonRect = selected.getBoundingClientRect();
    asideBoxRef.current = {
      width: asideRect.width,
      height: asideRect.height,
      top: asideRect.top,
      right: asideRect.right,
    };
    targetYRef.current = buttonRect.top + buttonRect.height / 2 - asideRect.top;

    const folder = folders.find((f) => f.id === selectedFolderId);
    const Icon = (folder?.special_use && folderIcons[folder.special_use]) || Folder;
    setActiveIcon(() => Icon);
    setBubbleVisible(true);

    if (posYRef.current === null) {
      posYRef.current = targetYRef.current;
      velYRef.current = 0;
      applyFrame();
      return;
    }
    startSpring();
  }

  const selectedFolderIdRef = useRef(selectedFolderId);
  useEffect(() => {
    selectedFolderIdRef.current = selectedFolderId;
  }, [selectedFolderId]);

  useLayoutEffect(() => {
    recomputeTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId, folders]);

  useEffect(() => {
    const asideEl = asideRef.current;
    const navEl = navRef.current;
    if (!asideEl) return;

    function handleGeometryChange() {
      const currentId = selectedFolderIdRef.current;
      if (!currentId) return;
      const asideRect = asideEl!.getBoundingClientRect();
      const selected = itemRefs.current.get(currentId);
      if (!selected) return;
      const buttonRect = selected.getBoundingClientRect();
      asideBoxRef.current = {
        width: asideRect.width,
        height: asideRect.height,
        top: asideRect.top,
        right: asideRect.right,
      };
      targetYRef.current = buttonRect.top + buttonRect.height / 2 - asideRect.top;
      startSpring();
    }

    const observer = new ResizeObserver(handleGeometryChange);
    observer.observe(asideEl);

    window.addEventListener("resize", handleGeometryChange);
    navEl?.addEventListener("scroll", handleGeometryChange, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleGeometryChange);
      navEl?.removeEventListener("scroll", handleGeometryChange);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside
      ref={asideRef}
      className="glass-panel relative flex w-60 flex-shrink-0 flex-col rounded-none border-y-0 border-l-0 border-r-2 border-r-accent/30 bg-white/80 backdrop-blur-2xl backdrop-saturate-150 p-3 dark:border-r-accent/40 dark:bg-neutral-900/80"
      style={{ filter: "drop-shadow(0 6px 18px rgba(15, 23, 42, 0.16))" }}
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
        {folders.map((folder, i) => {
          const Icon = (folder.special_use && folderIcons[folder.special_use]) || Folder;
          const isSelected = folder.id === selectedFolderId;
          const prevFolder = folders[i - 1];
          const showDivider = !folder.special_use && !!prevFolder && !!prevFolder.special_use;
          return (
            <Fragment key={folder.id}>
              {showDivider && <div className="my-1.5 border-t border-black/[0.06] dark:border-white/[0.08]" />}
              <button
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
            </Fragment>
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

      {createPortal(
        <>
          <div
            ref={glowRef}
            aria-hidden
            className={clsx(
              "pointer-events-none fixed z-20 rounded-full bg-accent/25 blur-xl transition-opacity duration-200 dark:bg-accent/30",
              bubbleVisible ? "opacity-100" : "opacity-0",
            )}
            style={{ width: GLOW_SIZE, height: GLOW_SIZE }}
          />
          <div
            ref={bubbleRef}
            aria-hidden
            className={clsx(
              "pointer-events-none fixed z-30 flex items-center justify-center rounded-full bg-accent text-white shadow-glass-lg ring-4 ring-white/70 transition-opacity duration-200 dark:ring-neutral-900/70",
              bubbleVisible ? "opacity-100" : "opacity-0",
            )}
            style={{ width: NOTCH_BUBBLE_SIZE, height: NOTCH_BUBBLE_SIZE }}
          >
            <ActiveIcon size={19} strokeWidth={1.75} />
          </div>
        </>,
        document.body,
      )}
    </aside>
  );
}
