import clsx from "clsx";
import { AtSign, Bell, PenLine, RefreshCw, Sparkles, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { AccountsSettings } from "@/components/settings/AccountsSettings";
import { AiSummarySettings } from "@/components/settings/AiSummarySettings";
import { SignatureEditor } from "@/components/settings/SignatureEditor";
import { LabelManager } from "@/components/settings/LabelManager";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { UpdateSettings } from "@/components/settings/UpdateSettings";
import { useUiStore } from "@/store/useUiStore";
import type { SettingsPanel } from "@/store/useUiStore";

const TABS: { id: Exclude<SettingsPanel, null>; label: string; icon: LucideIcon }[] = [
  { id: "accounts", label: "Accounts", icon: AtSign },
  { id: "signatures", label: "Signatures", icon: PenLine },
  { id: "labels", label: "Labels", icon: Tag },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI Summary", icon: Sparkles },
  { id: "updates", label: "Updates", icon: RefreshCw },
];

export function SettingsModal() {
  const panel = useUiStore((s) => s.settingsPanel);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openSettings = useUiStore((s) => s.openSettings);

  return (
    <Modal open={panel !== null} onClose={closeSettings} title="Settings" widthClassName="max-w-2xl">
      <div className="flex gap-5">
        <div className="w-36 flex-shrink-0 border-r border-black/5 dark:border-white/10 pr-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => openSettings(id)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                panel === id
                  ? "bg-accent/10 text-accent"
                  : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10",
              )}
            >
              <Icon size={15} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-[280px] flex-1">
          {panel === "accounts" && <AccountsSettings />}
          {panel === "signatures" && <SignatureEditor />}
          {panel === "labels" && <LabelManager />}
          {panel === "notifications" && <NotificationSettings />}
          {panel === "ai" && <AiSummarySettings />}
          {panel === "updates" && <UpdateSettings />}
        </div>
      </div>
    </Modal>
  );
}
