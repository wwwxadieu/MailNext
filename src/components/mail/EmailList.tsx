import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import clsx from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import type { MessageRow } from "@/types/mail";

export function EmailList() {
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const folders = useMailStore((s) => s.folders);
  const selectedFolderId = useMailStore((s) => s.selectedFolderId);
  const messages = useMailStore((s) => s.messages);
  const selectedMessageId = useMailStore((s) => s.selectedMessageId);
  const selectMessage = useMailStore((s) => s.selectMessage);
  const markRead = useMailStore((s) => s.markRead);
  const isLoadingMessages = useMailStore((s) => s.isLoadingMessages);

  const [query, setQuery] = useState("");
  const folder = folders.find((f) => f.id === selectedFolderId) ?? null;

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
    <section className="glass-panel flex w-[360px] flex-shrink-0 flex-col rounded-none border-y-0">
      <header className="flex flex-shrink-0 flex-col gap-2 border-b border-black/5 dark:border-white/10 p-3">
        <h1 className="px-1 text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {folder?.name ?? "Select a folder"}
        </h1>
        <div className="flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/5 px-2.5 py-1.5">
          <Search size={14} strokeWidth={1.5} className="text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mail"
            className="w-full bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoadingMessages && messages.length === 0 && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-400">
            <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />
            Loading messages…
          </div>
        )}

        {!isLoadingMessages && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 p-10 text-center text-sm text-neutral-400">
            No messages here yet.
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
                {message.from_name || message.from_address || "Unknown sender"}
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
