import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import {
  Archive,
  Flag,
  Forward,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  Paperclip,
  Reply,
  Send,
  Signature,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { HtmlMessageFrame } from "@/components/mail/HtmlMessageFrame";
import { RichTextEditor } from "@/components/mail/RichTextEditor";
import { SenderAvatar } from "@/components/mail/SenderAvatar";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useUiStore } from "@/store/useUiStore";
import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import { extractPlainText } from "@/lib/text";
import { toImapConnection, toSmtpConnection } from "@/lib/connection";
import { useT } from "@/lib/useT";
import type { MessageRow, OutgoingMessage, SignatureRow } from "@/types/mail";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Quotes the original message as escaped plain text rather than embedding
// its raw HTML: `message.body_html` is untrusted and normally only ever
// rendered inside HtmlMessageFrame's script-less sandboxed iframe (see that
// file's docs) — pasting it straight into this contentEditable body would
// let inline event-handler attributes (e.g. <img onerror=...>) execute in
// the app's own unsandboxed webview.
function buildForwardQuote(message: MessageRow, toLabel: string): string {
  const plainBody = extractPlainText(message.body_text, message.body_html);
  const quotedLines = escapeHtml(plainBody).split("\n").join("<br>");
  return [
    "<br><br>",
    '<div style="border-left:2px solid #ccc;padding-left:10px;color:#8e8e93;">',
    "---------- Forwarded message ----------<br>",
    `From: ${escapeHtml(message.from_name || message.from_address || "")}<br>`,
    `Date: ${escapeHtml(safeFormat(message.date))}<br>`,
    `Subject: ${escapeHtml(message.subject)}<br>`,
    `To: ${escapeHtml(toLabel)}<br><br>`,
    quotedLines,
    "</div>",
  ].join("");
}

export function EmailView() {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const folders = useMailStore((s) => s.folders);
  const selectedFolderId = useMailStore((s) => s.selectedFolderId);
  const messages = useMailStore((s) => s.messages);
  const selectedMessageId = useMailStore((s) => s.selectedMessageId);
  const toggleFlag = useMailStore((s) => s.toggleFlag);
  const isReadingPaneExpanded = useUiStore((s) => s.isReadingPaneExpanded);
  const toggleReadingPaneExpanded = useUiStore((s) => s.toggleReadingPaneExpanded);

  const folder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const message = messages.find((m) => m.id === selectedMessageId) ?? null;

  const [composeMode, setComposeMode] = useState<"reply" | "forward" | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [signaturesOpen, setSignaturesOpen] = useState(false);

  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const toAddresses = useMemo(() => (message ? repo.parseAddresses(message.to_json) : []), [message]);

  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setSummarizing(false);
    setComposeMode(null);
    setReplyBody("");
    setForwardTo("");
  }, [message?.id]);

  useEffect(() => {
    if (!activeAccount) return;
    let cancelled = false;
    void repo.listSignatures(activeAccount.id).then((list) => {
      if (!cancelled) setSignatures(list);
    });
    return () => {
      cancelled = true;
    };
  }, [activeAccount?.id]);

  function openReply() {
    setComposeMode((current) => (current === "reply" ? null : "reply"));
    setReplyBody("");
  }

  function openForward() {
    if (!message) return;
    setComposeMode((current) => (current === "forward" ? null : "forward"));
    setForwardTo("");
    setReplyBody(buildForwardQuote(message, toAddresses.map((a) => a.name || a.address).join(", ")));
  }

  function insertSignature(signature: SignatureRow) {
    setSignaturesOpen(false);
    setReplyBody((current) => `${current}<br><br>${signature.content_html}`);
  }

  if (!message) {
    return (
      <section className="solid-panel relative flex flex-1 flex-col items-center justify-center gap-2 rounded-none border-0 text-neutral-400">
        <div className="absolute right-3 top-3">
          <ActionButton
            label={t(isReadingPaneExpanded ? "emailView.collapse" : "emailView.expand")}
            onClick={toggleReadingPaneExpanded}
          >
            {isReadingPaneExpanded ? <Minimize2 size={15} strokeWidth={1.5} /> : <Maximize2 size={15} strokeWidth={1.5} />}
          </ActionButton>
        </div>
        <Mail size={32} strokeWidth={1.2} />
        <p className="text-sm">{t("emailView.selectMessage")}</p>
      </section>
    );
  }

  function parseAddressList(value: string) {
    return value
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
      .map((address) => ({ name: null, address }));
  }

  async function handleSendCompose() {
    if (!activeAccount || !folder || !message || !composeMode) return;
    setSending(true);
    setSendError(null);
    try {
      const outgoing: OutgoingMessage =
        composeMode === "forward"
          ? {
              from: { name: activeAccount.display_name, address: activeAccount.email },
              to: parseAddressList(forwardTo),
              cc: [],
              bcc: [],
              subject: message.subject.toLowerCase().startsWith("fwd:") ? message.subject : `Fwd: ${message.subject}`,
              bodyText: extractPlainText(null, replyBody),
              bodyHtml: replyBody,
              inReplyTo: null,
              references: [],
              attachments: [],
            }
          : {
              from: { name: activeAccount.display_name, address: activeAccount.email },
              to: message.from_address ? [{ name: message.from_name, address: message.from_address }] : [],
              cc: [],
              bcc: [],
              subject: message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject}`,
              bodyText: extractPlainText(null, replyBody),
              bodyHtml: replyBody,
              inReplyTo: message.message_id || null,
              references: message.message_id ? [message.message_id] : [],
              attachments: [],
            };
      await commands.smtpSend(toSmtpConnection(activeAccount), outgoing);
      setComposeMode(null);
      setReplyBody("");
      setForwardTo("");
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
    <section className="solid-panel flex flex-1 flex-col rounded-none border-0">
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
            <ActionButton label={t("emailView.reply")} onClick={openReply} active={composeMode === "reply"}>
              <Reply size={15} strokeWidth={1.5} />
            </ActionButton>
            <ActionButton label={t("emailView.forward")} onClick={openForward} active={composeMode === "forward"}>
              <Forward size={15} strokeWidth={1.5} />
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
            <ActionButton
              label={t(isReadingPaneExpanded ? "emailView.collapse" : "emailView.expand")}
              onClick={toggleReadingPaneExpanded}
            >
              {isReadingPaneExpanded ? (
                <Minimize2 size={15} strokeWidth={1.5} />
              ) : (
                <Maximize2 size={15} strokeWidth={1.5} />
              )}
            </ActionButton>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SenderAvatar name={message.from_name} address={message.from_address} size={36} />
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

      {composeMode && (
        <div className="flex-shrink-0 border-t border-black/5 dark:border-white/10 p-4">
          <div className="glass-panel rounded-xl p-3">
            {composeMode === "forward" && (
              <input
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
                placeholder={t("emailView.forwardTo")}
                className="mb-2 h-8 w-full border-b border-black/5 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:border-white/10 dark:text-neutral-100"
              />
            )}
            <RichTextEditor
              value={replyBody}
              onChange={setReplyBody}
              placeholder={t("emailView.replyPlaceholder", { name: message.from_name || message.from_address || "" })}
              minHeightClassName="min-h-[90px]"
              autoFocus
            />
            {sendError && <p className="mt-1 text-xs text-danger">{sendError}</p>}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="relative">
                <button
                  type="button"
                  aria-label={t("compose.insertSignature")}
                  title={t("compose.insertSignature")}
                  onClick={() => setSignaturesOpen((v) => !v)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <Signature size={16} strokeWidth={1.5} />
                </button>
                {signaturesOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSignaturesOpen(false)} />
                    <div className="glass-panel-elevated absolute bottom-8 left-0 z-20 max-h-56 w-56 overflow-y-auto rounded-xl p-1.5">
                      {signatures.length === 0 && (
                        <p className="px-2 py-2 text-xs text-neutral-400">{t("compose.noSignatures")}</p>
                      )}
                      {signatures.map((signature) => (
                        <button
                          key={signature.id}
                          onClick={() => insertSignature(signature)}
                          className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-black/5 dark:text-neutral-200 dark:hover:bg-white/10"
                        >
                          {signature.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setComposeMode(null)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {t("emailView.cancel")}
                </button>
                <button
                  onClick={handleSendCompose}
                  disabled={
                    sending ||
                    !extractPlainText(null, replyBody).trim() ||
                    (composeMode === "forward" && !forwardTo.trim())
                  }
                  className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  {sending ? <Loader2 size={13} className="animate-spin" strokeWidth={1.5} /> : <Send size={13} strokeWidth={1.5} />}
                  {t("emailView.send")}
                </button>
              </div>
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
