import { useMemo, useState } from "react";
import { ListFilter, Loader2, RefreshCw, Search } from "lucide-react";
import clsx from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useUiStore } from "@/store/useUiStore";
import { useT } from "@/lib/useT";
import type { MessageRow } from "@/types/mail";

export function EmailList() {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const folders = useMailStore((s) => s.folders);
  const selectedFolderId = useMailStore((s) => s.selectedFolderId);
  const messages = useMailStore((s) => s.messages);
  const selectedMessageId = useMailStore((s) => s.selectedMessageId);
  const selectMessage = useMailStore((s) => s.selectMessage);
  const markRead = useMailStore((s) => s.markRead);
  const isLoadingMessages = useMailStore((s) => s.isLoadingMessages);
  const loadFolders = useMailStore((s) => s.loadFolders);
  const loadMessages = useMailStore((s) => s.loadMessages);
  const openSettings = useUiStore((s) => s.openSettings);

  const [query, setQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const folder = folders.find((f) => f.id === selectedFolderId) ?? null;

  async function handleSync() {
    if (!activeAccount || isSyncing) return;
    setIsSyncing(true);
    try {
      await loadFolders(activeAccount);
      const current = useMailStore.getState().folders.find((f) => f.id === selectedFolderId) ?? folder;
      if (current) await loadMessages(activeAccount, current);
    } finally {
      setIsSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return messages;
    const q = query.toLowerCase();
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        (m.from_name ?? "").toLowerCase().includes(q) ||
        (m.from_address ?? "").toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q),
    );
  }, [messages, query]);

  function handleOpen(message: MessageRow) {
    selectMessage(message.id);
    if (activeAccount && folder && message.is_read === 0) {
      void markRead(activeAccount, folder, message, true);
    }
  }

  return (
    <section className="solid-panel flex w-[360px] flex-shrink-0 flex-col rounded-none border-y-0">
      <header className="flex flex-shrink-0 flex-col gap-2 border-b border-black/5 dark:border-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 flex-1 truncate px-1 text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {folder ? (folder.special_use ? t(`folder.${folder.special_use}`) : folder.name) : t("emailList.selectFolder")}
          </h1>
          <div className="flex flex-shrink-0 items-center gap-0.5">
            <button
              onClick={handleSync}
              disabled={!activeAccount || isSyncing}
              title={t("emailList.sync")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-neutral-200"
            >
              <RefreshCw size={14} strokeWidth={1.5} className={clsx(isSyncing && "animate-spin")} />
            </button>
            <button
              onClick={() => openSettings("rules")}
              title={t("emailList.rules")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
            >
              <ListFilter size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/5 px-2.5 py-1.5">
          <Search size={14} strokeWidth={1.5} className="text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("emailList.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoadingMessages && messages.length === 0 && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-400">
            <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />
            {t("emailList.loading")}
          </div>
        )}

        {!isLoadingMessages && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 p-10 text-center text-sm text-neutral-400">
            {t("emailList.empty")}
          </div>
        )}

        {filtered.map((message) => (
          <button
            key={message.id}
            onClick={() => handleOpen(message)}
            className={clsx(
              "flex w-full flex-col gap-1 border-b border-black/5 px-4 py-3 text-left transition-colors dark:border-white/5",
              message.id === selectedMessageId
                ? "bg-accent/10"
                : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={clsx(
                  "truncate text-[13px]",
                  message.is_read === 0
                    ? "font-semibold text-neutral-900 dark:text-neutral-50"
                    : "font-medium text-neutral-600 dark:text-neutral-300",
                )}
              >
                {message.from_name || message.from_address || t("app.unknownSender")}
              </span>
              <span className="flex-shrink-0 text-[11px] text-neutral-400 tabular-nums">
                {safeDistance(message.date)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {message.is_read === 0 && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />}
              <span
                className={clsx(
                  "truncate text-[13px]",
                  message.is_read === 0
                    ? "text-neutral-800 dark:text-neutral-100"
                    : "text-neutral-500 dark:text-neutral-400",
                )}
              >
                {message.subject}
              </span>
            </div>
            <p className="truncate text-[12px] text-neutral-400">{message.snippet}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function safeDistance(date: string): string {
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: false });
  } catch {
    return "";
  }
}
