import { lazy, Suspense } from "react";
import clsx from "clsx";
import { AtSign, Bell, FileText, Filter, HardDrive, PenLine, RefreshCw, SunMoon, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useUiStore } from "@/store/useUiStore";
import type { SettingsPanel } from "@/store/useUiStore";
import { useT } from "@/lib/useT";

// Lazy-loaded so opening the app doesn't pull in every settings tab's code
// (rich text template editor, signature editor, etc.) before Settings is
// ever opened — most sessions never touch most of these tabs.
const GeneralSettings = lazy(() =>
  import("@/components/settings/GeneralSettings").then((m) => ({ default: m.GeneralSettings })),
);
const AccountsSettings = lazy(() =>
  import("@/components/settings/AccountsSettings").then((m) => ({ default: m.AccountsSettings })),
);
const SignatureEditor = lazy(() =>
  import("@/components/settings/SignatureEditor").then((m) => ({ default: m.SignatureEditor })),
);
const TemplateManager = lazy(() =>
  import("@/components/settings/TemplateManager").then((m) => ({ default: m.TemplateManager })),
);
const LabelManager = lazy(() =>
  import("@/components/settings/LabelManager").then((m) => ({ default: m.LabelManager })),
);
const RulesSettings = lazy(() =>
  import("@/components/settings/RulesSettings").then((m) => ({ default: m.RulesSettings })),
);
const NotificationSettings = lazy(() =>
  import("@/components/settings/NotificationSettings").then((m) => ({ default: m.NotificationSettings })),
);
const UpdateSettings = lazy(() =>
  import("@/components/settings/UpdateSettings").then((m) => ({ default: m.UpdateSettings })),
);
const BackupSettings = lazy(() =>
  import("@/components/settings/BackupSettings").then((m) => ({ default: m.BackupSettings })),
);

// Ordered by how often someone actually reaches for each tab: identity and
// day-to-day preferences first, mail-shaping features next, and the
// standalone "Updates" status page last (set off by a divider, since it's
// not a mail-configuration tab like the rest).
const TABS: { id: Exclude<SettingsPanel, null>; labelKey: string; icon: LucideIcon; dividerBefore?: boolean }[] = [
  { id: "accounts", labelKey: "settings.tab.accounts", icon: AtSign },
  { id: "general", labelKey: "settings.tab.general", icon: SunMoon },
  { id: "notifications", labelKey: "settings.tab.notifications", icon: Bell },
  { id: "rules", labelKey: "settings.tab.rules", icon: Filter },
  { id: "labels", labelKey: "settings.tab.labels", icon: Tag },
  { id: "signatures", labelKey: "settings.tab.signatures", icon: PenLine },
  { id: "templates", labelKey: "settings.tab.templates", icon: FileText },
  { id: "backup", labelKey: "settings.tab.backup", icon: HardDrive, dividerBefore: true },
  { id: "updates", labelKey: "settings.tab.updates", icon: RefreshCw },
];

export function SettingsModal() {
  const t = useT();
  const panel = useUiStore((s) => s.settingsPanel);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openSettings = useUiStore((s) => s.openSettings);

  return (
    <Modal
      open={panel !== null}
      onClose={closeSettings}
      title={t("settings.title")}
      widthClassName="max-w-2xl"
      panelClassName="bg-white/97 dark:bg-neutral-900/95"
      noBodyPadding
    >
      {/* Horizontal, icon-over-label tab bar — the classic macOS
       * System Preferences / Mail Preferences pane layout, in place of the
       * left vertical sidebar this used to have. */}
      <nav className="flex flex-wrap gap-0.5 border-b border-black/5 bg-black/[0.015] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.015]">
        {TABS.map(({ id, labelKey, icon: Icon, dividerBefore }) => (
          <div key={id} className="flex items-center">
            {dividerBefore && <div className="mx-1.5 h-8 w-px bg-black/10 dark:bg-white/10" />}
            <button
              onClick={() => openSettings(id)}
              className={clsx(
                "flex w-[62px] flex-col items-center gap-1 rounded-[10px] px-1 py-1.5 text-center transition-colors",
                panel === id
                  ? "bg-accent/12 text-accent"
                  : "text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10",
              )}
            >
              <Icon size={19} strokeWidth={1.6} />
              <span className="text-[10.5px] font-medium leading-none">{t(labelKey)}</span>
            </button>
          </div>
        ))}
      </nav>
      <div className="min-h-[300px] px-5 py-5">
        <Suspense fallback={null}>
          {panel === "general" && <GeneralSettings />}
          {panel === "accounts" && <AccountsSettings />}
          {panel === "signatures" && <SignatureEditor />}
          {panel === "templates" && <TemplateManager />}
          {panel === "labels" && <LabelManager />}
          {panel === "rules" && <RulesSettings />}
          {panel === "notifications" && <NotificationSettings />}
          {panel === "backup" && <BackupSettings />}
          {panel === "updates" && <UpdateSettings />}
        </Suspense>
      </div>
    </Modal>
  );
}
