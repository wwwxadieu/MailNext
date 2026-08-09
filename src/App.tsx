import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { EmailList } from "@/components/mail/EmailList";
import { EmailView } from "@/components/mail/EmailView";
import { ComposeModal } from "@/components/mail/ComposeModal";
import { FloatingComposeButton } from "@/components/mail/FloatingComposeButton";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { UpdateBanner } from "@/components/update/UpdateBanner";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useLocaleStore } from "@/store/useLocaleStore";
import { useUpdateStore } from "@/store/useUpdateStore";
import { useUiStore } from "@/store/useUiStore";
import * as commands from "@/lib/commands";
import { toImapConnection } from "@/lib/connection";
import { getSetting } from "@/lib/repository";
import { playChime } from "@/lib/sound";
import type { ChimeId } from "@/lib/sound";

interface NewMailEvent {
  accountEmail: string;
  folder: string;
  unseenCount: number;
  subject: string;
  from: string;
}

export default function App() {
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const hydrateAccounts = useAccountStore((s) => s.hydrate);
  const hydrated = useAccountStore((s) => s.hydrated);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const folders = useMailStore((s) => s.folders);
  const loadMessages = useMailStore((s) => s.loadMessages);

  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const isReadingPaneExpanded = useUiStore((s) => s.isReadingPaneExpanded);

  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    void Promise.all([hydrateTheme(), hydrateLocale(), hydrateAccounts()]).then(() => setBootstrapped(true));
  }, []);

  // Check for app updates shortly after launch, then periodically in the
  // background — never in the middle of a download already in progress.
  useEffect(() => {
    const initial = setTimeout(() => void checkForUpdates(), 5000);
    const interval = setInterval(() => void checkForUpdates(), 4 * 60 * 60 * 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  // Keep the background watcher pointed at whichever account/inbox is active.
  useEffect(() => {
    if (!activeAccount) return;
    const inbox = folders.find((f) => f.special_use === "inbox");
    if (!inbox) return;

    void getSetting("poll_interval_secs").then((value) => {
      const intervalSecs = value ? Number(value) : 90;
      void commands.startMailWatcher(activeAccount.email, toImapConnection(activeAccount), inbox.path, intervalSecs);
    });

    return () => {
      void commands.stopMailWatcher(activeAccount.email, inbox.path);
    };
  }, [activeAccount?.id, folders.length]);

  useEffect(() => {
    const unlisten = listen<NewMailEvent>("mail://new-mail", async (event) => {
      const [soundEnabled, chime] = await Promise.all([getSetting("sound_enabled"), getSetting("sound_chime")]);
      if (soundEnabled !== "false") playChime((chime as ChimeId) ?? "chime-1");

      const account = accounts.find((a) => a.email === event.payload.accountEmail);
      const inbox = folders.find((f) => f.special_use === "inbox");
      if (account && inbox) void loadMessages(account, inbox);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [accounts, folders]);

  if (!bootstrapped || !hydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="relative flex h-screen w-screen flex-col overflow-hidden rounded-2xl">
        <TitleBar />
        <Onboarding onComplete={() => {}} />
        <UpdateBanner />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden rounded-2xl">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <div
          aria-hidden={isReadingPaneExpanded}
          className={clsx(
            "flex-shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-out",
            isReadingPaneExpanded ? "pointer-events-none w-0 opacity-0" : "w-60 opacity-100",
          )}
        >
          <Sidebar />
        </div>
        <EmailList />
        <EmailView />
      </div>
      <ComposeModal />
      <FloatingComposeButton />
      <SettingsModal />
      <UpdateBanner />
    </div>
  );
}
