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
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent/90 text-white shadow-glass-lg backdrop-blur-xl transition-all hover:scale-105 hover:bg-accent-hover/90 active:scale-95"
    >
      <Pencil size={20} strokeWidth={1.75} />
    </button>
  );
}
