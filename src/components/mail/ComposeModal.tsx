import { useEffect, useState, type CSSProperties } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { ComposeForm } from "@/components/mail/ComposeForm";
import type { ComposeDraft } from "@/components/mail/ComposeForm";
import { useUiStore } from "@/store/useUiStore";
import { openComposeWindow } from "@/lib/composeWindow";
import { useT } from "@/lib/useT";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const COLLAPSED_STYLE: CSSProperties = {
  top: "calc(100vh - 504px)",
  left: "calc(100vw - 464px)",
  width: "440px",
  height: "480px",
};

const EXPANDED_STYLE: CSSProperties = {
  top: "32px",
  left: "32px",
  width: "calc(100vw - 64px)",
  height: "calc(100vh - 64px)",
};

export function ComposeModal() {
  const t = useT();
  const isComposing = useUiStore((s) => s.isComposing);
  const closeCompose = useUiStore((s) => s.closeCompose);
  const [isExpanded, setIsExpanded] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (isComposing) {
      setEntered(false);
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    setIsExpanded(false);
    setEntered(false);
  }, [isComposing]);

  const composeRecipient = useUiStore((s) => s.composeRecipient);

  if (!isComposing) return null;

  async function handleDetach(draft: ComposeDraft) {
    await openComposeWindow(draft);
    closeCompose();
  }

  return createPortal(
    <>
      <div
        aria-hidden
        className={clsx(
          "fixed inset-0 z-40 pointer-events-none bg-black/10 backdrop-blur-md transition-opacity duration-300 dark:bg-black/30",
          entered && isExpanded ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={clsx(
          "fixed z-50 flex flex-col transition-[top,left,width,height,opacity,transform]",
          entered ? "opacity-100" : "scale-[0.1] opacity-0",
        )}
        style={{
          ...(isExpanded ? EXPANDED_STYLE : COLLAPSED_STYLE),
          // Anchored near the floating compose button (bottom-6 right-6),
          // so opening zooms up out of that corner and closing reverses
          // back into it, instead of scaling from the box's own center.
          transformOrigin: "calc(100% - 26px) calc(100% - 26px)",
          transitionDuration: "320ms",
          transitionTimingFunction: EASE,
        }}
      >
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-black/15 bg-white/98 text-neutral-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-black/10 backdrop-blur-2xl dark:border-white/15 dark:bg-neutral-900/98 dark:text-neutral-100 dark:ring-white/10">
          <div className="flex flex-shrink-0 items-center justify-between rounded-t-2xl border-b border-black/10 bg-black/[0.02] px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.02]">
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("compose.title")}</span>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsExpanded((v) => !v)}
                aria-label={isExpanded ? t("compose.collapse") : t("compose.expand")}
                className="text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                {isExpanded ? <Minimize2 size={14} strokeWidth={1.5} /> : <Maximize2 size={14} strokeWidth={1.5} />}
              </button>
              <button
                onClick={closeCompose}
                aria-label={t("compose.close")}
                className="text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <ComposeForm
            initialDraft={{ to: composeRecipient ?? "" }}
            onSent={closeCompose}
            onDetach={(draft) => void handleDetach(draft)}
            bodyMinHeightClassName={isExpanded ? "min-h-[320px]" : undefined}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
