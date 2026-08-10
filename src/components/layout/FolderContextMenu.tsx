import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, CheckCheck, Palette, Trash2, X } from "lucide-react";
import type { FolderRow } from "@/types/mail";
import { useT } from "@/lib/useT";

interface FolderContextMenuProps {
  x: number;
  y: number;
  folder: FolderRow;
  onClose: () => void;
  onSetColor: (color: string | null) => void;
  onMarkAllRead: () => void;
  onDeleteFolder?: () => void;
}

const PRESET_COLORS = [
  "#0A84FF", // Blue
  "#30D158", // Green
  "#FF9F0A", // Orange
  "#FF375F", // Pink
  "#BF5AF2", // Purple
  "#64D2FF", // Cyan
  "#FFD60A", // Yellow
];

export function FolderContextMenu({
  x,
  y,
  folder,
  onClose,
  onSetColor,
  onMarkAllRead,
  onDeleteFolder,
}: FolderContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Adjust menu position so it doesn't overflow window edges
  const width = 220;
  const height = 180;
  const adjustedX = Math.min(x, window.innerWidth - width - 12);
  const adjustedY = Math.min(y, window.innerHeight - height - 12);

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="glass-panel-elevated fixed z-50 flex w-56 flex-col overflow-hidden rounded-2xl border border-black/15 bg-white/95 p-2 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-neutral-900/95 animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-between px-2 py-1 border-b border-black/5 dark:border-white/10 mb-1">
        <span className="truncate text-xs font-semibold text-neutral-800 dark:text-neutral-200">
          {folder.name}
        </span>
        <button
          onClick={onClose}
          className="rounded-full p-0.5 text-neutral-400 hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      </div>

      {/* Color Picker Section */}
      <div className="px-2 py-1.5 space-y-1.5">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
          <Palette size={12} />
          <span>{t("folder.colorLabel") ?? "Màu thư mục"}</span>
        </div>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                onSetColor(color);
                onClose();
              }}
              className="flex h-5.5 w-5.5 items-center justify-center rounded-full transition-transform hover:scale-115"
              style={{ backgroundColor: color }}
              title="Đổi màu"
            >
              {folder.color === color && <Check size={11} className="text-white" strokeWidth={3} />}
            </button>
          ))}
          {folder.color && (
            <button
              type="button"
              onClick={() => {
                onSetColor(null);
                onClose();
              }}
              className="flex h-5.5 w-5.5 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600 text-[10px] font-bold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              title="Xóa màu"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="my-1 border-t border-black/5 dark:border-white/10" />

      {/* Actions */}
      <button
        onClick={() => {
          onMarkAllRead();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-neutral-700 hover:bg-black/5 dark:text-neutral-200 dark:hover:bg-white/10"
      >
        <CheckCheck size={14} strokeWidth={1.5} className="text-accent" />
        <span>{t("folder.markAllRead") ?? "Đánh dấu tất cả đã đọc"}</span>
      </button>

      {onDeleteFolder && !folder.special_use && (
        <button
          onClick={() => {
            onDeleteFolder();
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-danger hover:bg-danger/10"
        >
          <Trash2 size={14} strokeWidth={1.5} />
          <span>{t("folderModal.delete") ?? "Xóa thư mục"}</span>
        </button>
      )}
    </div>,
    document.body,
  );
}
