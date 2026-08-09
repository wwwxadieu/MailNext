import clsx from "clsx";
import { AtSign, Bell, FileText, Filter, HardDrive, PenLine, RefreshCw, Sparkles, SunMoon, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { AccountsSettings } from "@/components/settings/AccountsSettings";
import { AiSummarySettings } from "@/components/settings/AiSummarySettings";
import { SignatureEditor } from "@/components/settings/SignatureEditor";
import { TemplateManager } from "@/components/settings/TemplateManager";
import { LabelManager } from "@/components/settings/LabelManager";
import { RulesSettings } from "@/components/settings/RulesSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { UpdateSettings } from "@/components/settings/UpdateSettings";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { useUiStore } from "@/store/useUiStore";
import type { SettingsPanel } from "@/store/useUiStore";
import { useT } from "@/lib/useT";

const TABS: { id: Exclude<SettingsPanel, null>; labelKey: string; icon: LucideIcon }[] = [
  { id: "general", labelKey: "settings.tab.general", icon: SunMoon },
  { id: "accounts", labelKey: "settings.tab.accounts", icon: AtSign },
  { id: "signatures", labelKey: "settings.tab.signatures", icon: PenLine },
  { id: "templates", labelKey: "settings.tab.templates", icon: FileText },
  { id: "labels", labelKey: "settings.tab.labels", icon: Tag },
  { id: "rules", labelKey: "settings.tab.rules", icon: Filter },
  { id: "notifications", labelKey: "settings.tab.notifications", icon: Bell },
  { id: "backup", labelKey: "settings.tab.backup", icon: HardDrive },
  { id: "ai", labelKey: "settings.tab.ai", icon: Sparkles },
  { id: "updates", labelKey: "settings.tab.updates", icon: RefreshCw },
];

export function SettingsModal() {
  const t = useT();
  const panel = useUiStore((s) => s.settingsPanel);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openSettings = useUiStore((s) => s.openSettings);

  return (
    <Modal open={panel !== null} onClose={closeSettings} title={t("settings.title")} widthClassName="max-w-2xl">
      <div className="flex gap-5">
        <div className="w-36 flex-shrink-0 border-r border-black/5 dark:border-white/10 pr-3">
          {TABS.map(({ id, labelKey, icon: Icon }) => (
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
              {t(labelKey) ?? (id === "backup" ? "Sao lưu" : id)}
            </button>
          ))}
        </div>
        <div className="min-h-[280px] flex-1">
          {panel === "general" && <GeneralSettings />}
          {panel === "accounts" && <AccountsSettings />}
          {panel === "signatures" && <SignatureEditor />}
          {panel === "templates" && <TemplateManager />}
          {panel === "labels" && <LabelManager />}
          {panel === "rules" && <RulesSettings />}
          {panel === "notifications" && <NotificationSettings />}
          {panel === "backup" && <BackupSettings />}
          {panel === "ai" && <AiSummarySettings />}
          {panel === "updates" && <UpdateSettings />}
        </div>
      </div>
    </Modal>
  );
}
