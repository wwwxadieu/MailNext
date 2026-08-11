import { Pencil } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";
import { useT } from "@/lib/useT";

export function FloatingComposeButton() {
  const t = useT();
  const isComposing = useUiStore((s) => s.isComposing);
  const openCompose = useUiStore((s) => s.openCompose);

  if (isComposing) return null;

  return (
    <button
      onClick={() => openCompose()}
      title={t("sidebar.compose")}
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-accent/80 text-white shadow-[0_10px_28px_-6px_rgba(10,132,255,0.55),inset_0_1px_0_0_rgba(255,255,255,0.35)] backdrop-blur-xl backdrop-saturate-150 transition-all hover:scale-105 hover:bg-accent-hover/85 active:scale-95 dark:border-white/15 dark:shadow-[0_10px_28px_-6px_rgba(10,132,255,0.4),inset_0_1px_0_0_rgba(255,255,255,0.15)]"
    >
      <Pencil size={20} strokeWidth={1.75} />
    </button>
  );
}
