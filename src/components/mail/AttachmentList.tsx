import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Check, File, FileText, Image as ImageIcon, Loader2, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as commands from "@/lib/commands";
import { useT } from "@/lib/useT";
import type { EmailAttachment } from "@/types/mail";

interface AttachmentListProps {
  attachments: EmailAttachment[];
}

function iconForMimeType(mimeType: string): LucideIcon {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ attachments }: AttachmentListProps) {
  const t = useT();
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function handleSave(attachment: EmailAttachment, index: number) {
    setError(null);
    const path = await save({ defaultPath: attachment.filename });
    if (!path) return;
    setSavingIndex(index);
    try {
      await commands.saveAttachmentFile(path, attachment.contentBase64);
      setSavedIndex(index);
      setTimeout(() => setSavedIndex((current) => (current === index ? null : current)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {t("emailView.attachmentsCount", { count: attachments.length })}
      </p>
      <div className="flex flex-col gap-1.5">
        {attachments.map((attachment, index) => {
          const Icon = iconForMimeType(attachment.mimeType);
          const isSaving = savingIndex === index;
          const isSaved = savedIndex === index;
          return (
            <div
              key={`${attachment.filename}-${index}`}
              className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]"
            >
              <Icon size={16} strokeWidth={1.5} className="flex-shrink-0 text-neutral-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-100">
                  {attachment.filename}
                </p>
                <p className="text-[11px] text-neutral-400">{formatFileSize(attachment.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleSave(attachment, index)}
                disabled={isSaving}
                title={t("emailView.saveAttachment")}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-black/5 hover:text-accent disabled:opacity-50 dark:hover:bg-white/10"
              >
                {isSaving ? (
                  <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                ) : isSaved ? (
                  <Check size={14} strokeWidth={2} className="text-success" />
                ) : (
                  <Download size={14} strokeWidth={1.5} />
                )}
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
