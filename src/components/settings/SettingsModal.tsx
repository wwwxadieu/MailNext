import { lazy, Suspense } from "react";
import clsx from "clsx";
import { AtSign, Bell, FileText, Filter, PenLine, RefreshCw, SunMoon, Tag } from "lucide-react";
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
  { id: "updates", labelKey: "settings.tab.updates", icon: RefreshCw, dividerBefore: true },
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
          {TABS.map(({ id, labelKey, icon: Icon, dividerBefore }) => (
            <div key={id}>
              {dividerBefore && <div className="my-2 border-t border-black/5 dark:border-white/10" />}
              <button
                onClick={() => openSettings(id)}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                  panel === id
                    ? "bg-accent/10 text-accent"
                    : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10",
                )}
              >
                <Icon size={15} strokeWidth={1.5} />
                {t(labelKey)}
              </button>
            </div>
          ))}
        </div>
        <div className="min-h-[280px] flex-1">
          <Suspense fallback={null}>
            {panel === "general" && <GeneralSettings />}
            {panel === "accounts" && <AccountsSettings />}
            {panel === "signatures" && <SignatureEditor />}
            {panel === "templates" && <TemplateManager />}
            {panel === "labels" && <LabelManager />}
            {panel === "rules" && <RulesSettings />}
            {panel === "notifications" && <NotificationSettings />}
            {panel === "updates" && <UpdateSettings />}
          </Suspense>
        </div>
      </div>
    </Modal>
  );
}
