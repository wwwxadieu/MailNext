import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { Archive, Flag, Loader2, Mail, Paperclip, Reply, Send, Sparkles, Trash2, X } from "lucide-react";
import { HtmlMessageFrame } from "@/components/mail/HtmlMessageFrame";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import { extractPlainText } from "@/lib/text";
import { toImapConnection, toSmtpConnection } from "@/lib/connection";
import { useT } from "@/lib/useT";
import type { OutgoingMessage } from "@/types/mail";

export function EmailView() {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const folders = useMailStore((s) => s.folders);
  const selectedFolderId = useMailStore((s) => s.selectedFolderId);
  const messages = useMailStore((s) => s.messages);
  const selectedMessageId = useMailStore((s) => s.selectedMessageId);
  const toggleFlag = useMailStore((s) => s.toggleFlag);

  const folder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const message = messages.find((m) => m.id === selectedMessageId) ?? null;

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const toAddresses = useMemo(() => (message ? repo.parseAddresses(message.to_json) : []), [message]);

  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setSummarizing(false);
  }, [message?.id]);

  if (!message) {
    return (
      <section className="glass-panel flex flex-1 flex-col items-center justify-center gap-2 rounded-none border-0 text-neutral-400">
        <Mail size={32} strokeWidth={1.2} />
        <p className="text-sm">{t("emailView.selectMessage")}</p>
      </section>
    );
  }

  async function handleSendReply() {
    if (!activeAccount || !folder || !message) return;
    setSending(true);
    setSendError(null);
    try {
      const outgoing: OutgoingMessage = {
        from: { name: activeAccount.display_name, address: activeAccount.email },
        to: message.from_address ? [{ name: message.from_name, address: message.from_address }] : [],
        cc: [],
        bcc: [],
        subject: message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject}`,
        bodyText: replyBody,
        bodyHtml: `<p>${escapeHtml(replyBody).replace(/\n/g, "<br />")}</p>`,
        inReplyTo: message.message_id || null,
        references: message.message_id ? [message.message_id] : [],
        attachments: [],
      };
      await commands.smtpSend(toSmtpConnection(activeAccount), outgoing);
      setReplyOpen(false);
      setReplyBody("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleSummarize() {
    if (!message) return;
    setSummarizing(true);
    setSummaryError(null);
    try {
      const plainText = extractPlainText(message.body_text, message.body_html);
      const result = await commands.summarizeEmail(message.subject, plainText);
      setSummary(result);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : String(err));
    } finally {
      setSummarizing(false);
    }
  }

  async function handleFlag() {
    if (activeAccount && folder && message) await toggleFlag(activeAccount, folder, message);
  }

  async function handleArchive() {
    if (!activeAccount || !folder || !message) return;
    const archiveFolder = folders.find((f) => f.special_use === "archive");
    if (!archiveFolder) return;
    await commands.imapMoveMessage(toImapConnection(activeAccount), folder.path, message.uid, archiveFolder.path);
  }

  async function handleDelete() {
    if (!activeAccount || !folder || !message) return;
    const trashFolder = folders.find((f) => f.special_use === "trash");
    if (!trashFolder) return;
    await commands.imapMoveMessage(toImapConnection(activeAccount), folder.path, message.uid, trashFolder.path);
  }

  return (
    <section className="glass-panel flex flex-1 flex-col rounded-none border-0">
      <header className="flex flex-shrink-0 flex-col gap-3 border-b border-black/5 dark:border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {message.subject}
          </h1>
          <div className="flex flex-shrink-0 items-center gap-1">
            <ActionButton label={t("emailView.summarize")} onClick={handleSummarize} active={summary !== null}>
              {summarizing ? (
                <Loader2 size={15} className="animate-spin" strokeWidth={1.5} />
              ) : (
                <Sparkles size={15} strokeWidth={1.5} />
              )}
            </ActionButton>
            <ActionButton label={t("emailView.reply")} onClick={() => setReplyOpen((v) => !v)}>
              <Reply size={15} strokeWidth={1.5} />
            </ActionButton>
            <ActionButton label={t("emailView.flag")} onClick={handleFlag} active={message.is_flagged === 1}>
              <Flag size={15} strokeWidth={1.5} />
            </ActionButton>
            <ActionButton label={t("emailView.archive")} onClick={handleArchive}>
              <Archive size={15} strokeWidth={1.5} />
            </ActionButton>
            <ActionButton label={t("emailView.delete")} onClick={handleDelete}>
              <Trash2 size={15} strokeWidth={1.5} />
            </ActionButton>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-medium text-accent">
            {(message.from_name || message.from_address || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {message.from_name || message.from_address}
            </p>
            <p className="truncate text-xs text-neutral-400">
              {t("emailView.to", { names: toAddresses.map((a) => a.name || a.address).join(", ") || t("emailView.you") })}
            </p>
          </div>
          <p className="flex-shrink-0 text-xs text-neutral-400">{safeFormat(message.date)}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {(summary || summaryError) && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/5 p-3">
            <Sparkles size={15} strokeWidth={1.5} className="mt-0.5 flex-shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              {summary && (
                <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">{summary}</p>
              )}
              {summaryError && <p className="text-xs text-danger">{summaryError}</p>}
            </div>
            <button
              onClick={() => {
                setSummary(null);
                setSummaryError(null);
              }}
              aria-label={t("emailView.dismissSummary")}
              className="flex-shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X size={13} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {message.body_html ? (
          <HtmlMessageFrame html={message.body_html} />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
            {message.body_text}
          </p>
        )}

        {message.has_attachments === 1 && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-neutral-400">
            <Paperclip size={13} strokeWidth={1.5} />
            {t("emailView.hasAttachments")}
          </div>
        )}
      </div>

      {replyOpen && (
        <div className="flex-shrink-0 border-t border-black/5 dark:border-white/10 p-4">
          <div className="glass-panel rounded-xl p-3">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={t("emailView.replyPlaceholder", { name: message.from_name || message.from_address || "" })}
              rows={4}
              className="w-full resize-none bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
              autoFocus
            />
            {sendError && <p className="mt-1 text-xs text-danger">{sendError}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setReplyOpen(false)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
              >
                {t("emailView.cancel")}
              </button>
              <button
                onClick={handleSendReply}
                disabled={sending || !replyBody.trim()}
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                {sending ? <Loader2 size={13} className="animate-spin" strokeWidth={1.5} /> : <Send size={13} strokeWidth={1.5} />}
                {t("emailView.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
        active ? "text-accent" : "text-neutral-500 dark:text-neutral-400"
      }`}
    >
      {children}
    </button>
  );
}

function safeFormat(date: string): string {
  try {
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return date;
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
