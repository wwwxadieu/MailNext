import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { ComposeForm } from "@/components/mail/ComposeForm";
import type { ComposeDraft } from "@/components/mail/ComposeForm";
import { useUiStore } from "@/store/useUiStore";
import { openComposeWindow } from "@/lib/composeWindow";
import { useT } from "@/lib/useT";

export function ComposeModal() {
  const t = useT();
  const isComposing = useUiStore((s) => s.isComposing);
  const closeCompose = useUiStore((s) => s.closeCompose);

  if (!isComposing) return null;

  async function handleDetach(draft: ComposeDraft) {
    await openComposeWindow(draft);
    closeCompose();
  }

  return createPortal(
    <div className="fixed bottom-6 right-6 z-50 flex h-[480px] w-[440px] flex-col">
      <div className="glass-panel-elevated flex flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex flex-shrink-0 items-center justify-between rounded-t-2xl border-b border-black/5 dark:border-white/10 px-4 py-2.5">
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{t("compose.title")}</span>
          <button onClick={closeCompose} aria-label={t("compose.close")} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <ComposeForm onSent={closeCompose} onDetach={(draft) => void handleDetach(draft)} />
      </div>
    </div>,
    document.body,
  );
}
