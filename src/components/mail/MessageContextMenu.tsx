import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, Flag, Mail, MailOpen, Tag, Trash2 } from "lucide-react";
import clsx from "clsx";
import * as repo from "@/lib/repository";
import { useT } from "@/lib/useT";
import type { LabelRow, MessageRow } from "@/types/mail";

interface MessageContextMenuProps {
  x: number;
  y: number;
  message: MessageRow;
  accountId: string;
  onClose: () => void;
  onToggleRead: () => void;
  onToggleFlag: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onManageLabels: () => void;
}

export function MessageContextMenu({
  x,
  y,
  message,
  accountId,
  onClose,
  onToggleRead,
  onToggleFlag,
  onSelect,
  onDelete,
  onManageLabels,
}: MessageContextMenuProps) {
  const t = useT();
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [messageLabelIds, setMessageLabelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void Promise.all([repo.listLabels(accountId), repo.listLabelsForMessage(message.id)]).then(
      ([allLabels, messageLabels]) => {
        if (cancelled) return;
        setLabels(allLabels);
        setMessageLabelIds(new Set(messageLabels.map((l) => l.id)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [accountId, message.id]);

  async function toggleLabel(label: LabelRow) {
    const hasLabel = messageLabelIds.has(label.id);
    if (hasLabel) {
      await repo.removeLabelFromMessage(message.id, label.id);
      setMessageLabelIds((current) => {
        const next = new Set(current);
        next.delete(label.id);
        return next;
      });
    } else {
      await repo.addLabelToMessage(message.id, label.id);
      setMessageLabelIds((current) => new Set(current).add(label.id));
    }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        className="glass-panel-elevated fixed z-50 w-56 overflow-hidden rounded-xl p-1.5"
        style={{ top: y, left: x }}
      >
        <MenuItem
          icon={message.is_read === 0 ? MailOpen : Mail}
          label={message.is_read === 0 ? t("contextMenu.markRead") : t("contextMenu.markUnread")}
          onClick={() => {
            onToggleRead();
            onClose();
          }}
        />
        <MenuItem
          icon={Flag}
          label={message.is_flagged === 1 ? t("contextMenu.unflag") : t("contextMenu.flag")}
          onClick={() => {
            onToggleFlag();
            onClose();
          }}
        />
        <MenuItem
          icon={CheckSquare}
          label={t("contextMenu.select")}
          onClick={() => {
            onSelect();
            onClose();
          }}
        />

        {labels.length > 0 && (
          <>
            <div className="my-1 border-t border-black/5 dark:border-white/10" />
            <p className="px-2.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              {t("contextMenu.labels")}
            </p>
            {labels.map((label) => (
              <button
                key={label.id}
                onClick={() => void toggleLabel(label)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-black/5 dark:text-neutral-200 dark:hover:bg-white/10"
              >
                <span
                  className={clsx(
                    "h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20",
                    !messageLabelIds.has(label.id) && "opacity-30",
                  )}
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 truncate">{label.name}</span>
                {messageLabelIds.has(label.id) && <CheckSquare size={12} strokeWidth={2} className="text-accent" />}
              </button>
            ))}
          </>
        )}

        <div className="my-1 border-t border-black/5 dark:border-white/10" />
        <MenuItem
          icon={Tag}
          label={t("contextMenu.manageLabels")}
          onClick={() => {
            onManageLabels();
            onClose();
          }}
        />
        <MenuItem
          icon={Trash2}
          label={t("contextMenu.delete")}
          danger
          onClick={() => {
            onDelete();
            onClose();
          }}
        />
      </div>
    </>,
    document.body,
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Flag;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
        danger
          ? "text-danger hover:bg-danger/10"
          : "text-neutral-700 hover:bg-black/5 dark:text-neutral-200 dark:hover:bg-white/10",
      )}
    >
      <Icon size={13} strokeWidth={1.5} className="flex-shrink-0" />
      {label}
    </button>
  );
}
