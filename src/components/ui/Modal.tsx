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
}

export function Modal({ open, onClose, title, children, widthClassName = "max-w-md" }: ModalProps) {
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
          "glass-panel-elevated relative w-full mx-4 rounded-2xl p-5 transition-[opacity,transform] ease-out",
          widthClassName,
          entered ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
        style={{ transitionDuration: `${EXIT_DURATION_MS}ms` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
          <IconButton label={t("compose.close")} onClick={onClose}>
            <X size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
