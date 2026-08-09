import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TitleBar } from "@/components/layout/TitleBar";
import { ComposeForm } from "@/components/mail/ComposeForm";
import type { ComposeDraft } from "@/components/mail/ComposeForm";
import { takeComposeHandoff } from "@/lib/composeWindow";
import { useAccountStore } from "@/store/useAccountStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useLocaleStore } from "@/store/useLocaleStore";
import { useT } from "@/lib/useT";

/** Root rendered instead of <App /> when this window was opened as a
 * detached "New message" window (see composeWindow.ts / main.tsx). It's a
 * separate JS runtime from the main window, so it re-hydrates just the
 * stores it actually needs rather than the full app bootstrap. */
export function ComposeWindowRoot() {
  const t = useT();
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const hydrateAccounts = useAccountStore((s) => s.hydrate);
  const hydrated = useAccountStore((s) => s.hydrated);
  const activeAccount = useAccountStore((s) => s.activeAccount());

  const [ready, setReady] = useState(false);
  const [initialDraft] = useState<ComposeDraft | undefined>(() => takeComposeHandoff() ?? undefined);

  useEffect(() => {
    void Promise.all([hydrateTheme(), hydrateLocale(), hydrateAccounts()]).then(() => setReady(true));
  }, []);

  function close() {
    void getCurrentWindow().close();
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden rounded-2xl">
      <TitleBar>
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("compose.title")}</span>
      </TitleBar>
      <div className="glass-panel flex flex-1 flex-col overflow-hidden rounded-none border-0">
        {ready && hydrated && activeAccount ? (
          <ComposeForm
            initialDraft={initialDraft}
            onSent={close}
            bodyMinHeightClassName="min-h-[260px]"
            autoFocusBody={!initialDraft}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
