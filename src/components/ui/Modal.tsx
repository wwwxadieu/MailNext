import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";
import { IconButton } from "@/components/ui/IconButton";
import { useT } from "@/lib/useT";

const EXIT_DURATION_MS = 180;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClassName?: string;
  /** Extra classes for the panel itself — e.g. a higher opacity override
   * for a specific dialog, layered on top of (and winning over, per
   * Tailwind's components-then-utilities layer order) glass-panel-elevated's
   * default. */
  panelClassName?: string;
  /** Removes the default p-5 body padding, for dialogs (like Settings) that
   * need edge-to-edge content below the header, e.g. a horizontal tab bar. */
  noBodyPadding?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  widthClassName = "max-w-md",
  panelClassName,
  noBodyPadding,
}: ModalProps) {
  const t = useT();
  // Stays mounted for a beat after `open` goes false so the exit transition
  // below actually has time to play, instead of the dialog just vanishing.
  const [rendered, setRendered] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    setEntered(false);
    const timeout = setTimeout(() => setRendered(false), EXIT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!rendered) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={clsx(
          "absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: `${EXIT_DURATION_MS}ms` }}
        onClick={onClose}
      />
      <div
        className={clsx(
          "glass-panel-elevated relative w-full mx-4 overflow-hidden rounded-2xl transition-[opacity,transform] ease-out",
          widthClassName,
          panelClassName,
          entered ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
        style={{ transitionDuration: `${EXIT_DURATION_MS}ms` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={clsx(
            "flex items-center justify-between px-5 pt-5",
            noBodyPadding ? "pb-3" : "pb-4",
          )}
        >
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
          <IconButton label={t("compose.close")} onClick={onClose}>
            <X size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
        {noBodyPadding ? children : <div className="px-5 pb-5">{children}</div>}
      </div>
    </div>,
    document.body,
  );
}
