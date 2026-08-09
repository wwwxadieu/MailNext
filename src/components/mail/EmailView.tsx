import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { format } from "date-fns";
import {
  Archive,
  BellOff,
  ExternalLink,
  Flag,
  Forward,
  Info,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  Moon,
  Paperclip,
  Reply,
  Send,
  Signature,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { HtmlMessageFrame } from "@/components/mail/HtmlMessageFrame";
import { RichTextEditor } from "@/components/mail/RichTextEditor";
import { SenderAvatar } from "@/components/mail/SenderAvatar";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useUiStore } from "@/store/useUiStore";
import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import { extractPlainText } from "@/lib/text";
import { extractUnsubscribeUrl } from "@/lib/unsubscribe";
import { toImapConnection, toSmtpConnection } from "@/lib/connection";
import { useT } from "@/lib/useT";
import type { MessageRow, OutgoingMessage, SignatureRow } from "@/types/mail";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
  const openCompose = useUiStore((s) => s.openCompose);

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

  const [showDetails, setShowDetails] = useState(false);
  const [readingTheme, setReadingTheme] = useState<"auto" | "light" | "dark">("auto");
  const [unsubscribeToast, setUnsubscribeToast] = useState(false);

  const toAddresses = useMemo(() => (message ? repo.parseAddresses(message.to_json) : []), [message]);
  const unsubscribeUrl = useMemo(
    () => (message ? extractUnsubscribeUrl(message.body_html, message.body_text) : null),
    [message],
  );

  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setSummarizing(false);
    setComposeMode(null);
    setReplyBody("");
    setForwardTo("");
    setShowDetails(false);
    setUnsubscribeToast(false);
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

  const appIsDark = useThemeStore((s) => s.resolved === "dark");
  const effectiveIsDark = readingTheme === "light" ? false : readingTheme === "dark" ? true : appIsDark;

  function toggleReadingTheme() {
    setReadingTheme((current) => {
      const curIsDark = current === "light" ? false : current === "dark" ? true : appIsDark;
      return curIsDark ? "light" : "dark";
    });
  }

  function handleUnsubscribe() {
    if (!unsubscribeUrl) return;
    window.open(unsubscribeUrl, "_blank");
    setUnsubscribeToast(true);
    setTimeout(() => setUnsubscribeToast(false), 4000);
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
            {unsubscribeUrl && (
              <button
                onClick={handleUnsubscribe}
                className="flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/20 transition-all mr-1"
                title={t("emailView.unsubscribe") ?? "Hủy đăng ký nhận thư"}
              >
                <BellOff size={13} strokeWidth={2} />
                <span>{t("emailView.unsubscribe") ?? "Hủy đăng ký"}</span>
              </button>
            )}

            <ActionButton
              label={`Nền đọc: ${effectiveIsDark ? "Tối" : "Sáng"}`}
              onClick={toggleReadingTheme}
              active={readingTheme !== "auto"}
            >
              {effectiveIsDark ? (
                <Sun size={15} strokeWidth={1.5} className="text-amber-500" />
              ) : (
                <Moon size={15} strokeWidth={1.5} className="text-indigo-400" />
              )}
            </ActionButton>

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

        {/* Sender Info & Expander Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => openCompose(undefined, message.from_address || "")}
                className="flex-shrink-0 group/avatar hover:scale-105 transition-transform"
                title={t("emailView.quickComposeTo", { email: message.from_address || message.from_name || "" }) ?? `Soạn thư nhanh cho ${message.from_address}`}
              >
                <SenderAvatar name={message.from_name} address={message.from_address} size={38} />
              </button>

              <div className="min-w-0 flex-1 flex flex-col justify-center">
                {/* Sender Name, Email & Details Icon Button */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openCompose(undefined, message.from_address || "")}
                    className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100 hover:text-accent transition-colors text-left"
                    title={`Soạn thư nhanh cho ${message.from_address || message.from_name}`}
                  >
                    {message.from_name || message.from_address}
                  </button>
                  {message.from_name && message.from_address && (
                    <button
                      type="button"
                      onClick={() => openCompose(undefined, message.from_address || "")}
                      className="truncate text-xs text-neutral-400 font-normal hover:text-accent transition-colors text-left"
                      title={`Soạn thư nhanh cho ${message.from_address}`}
                    >
                      &lt;{message.from_address}&gt;
                    </button>
                  )}

                  {/* Icon Button for Details Expander */}
                  <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className={clsx(
                      "inline-flex items-center justify-center h-5 w-5 rounded-full text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors flex-shrink-0 ml-0.5",
                      showDetails && "bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent",
                    )}
                    title={showDetails ? "Ẩn chi tiết thư" : "Xem chi tiết thư"}
                  >
                    <Info size={13} strokeWidth={2} />
                  </button>
                </div>

                {/* Recipient Line */}
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5">
                  <span className="truncate">
                    {t("emailView.to", {
                      names: toAddresses.map((a) => (a.name ? `${a.name} (${a.address})` : a.address)).join(", ") || t("emailView.you"),
                    })}
                  </span>
                </div>
              </div>
            </div>

            <p className="flex-shrink-0 text-xs text-neutral-400 mt-1">{safeFormat(message.date)}</p>
          </div>

          {/* Expanded Metadata Panel */}
          {showDetails && (
            <div className="mt-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3.5 text-xs space-y-2 animate-in fade-in duration-150 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-400 w-16 flex-shrink-0">Từ:</span>
                <button
                  type="button"
                  onClick={() => openCompose(undefined, message.from_address || "")}
                  className="text-accent hover:underline font-medium truncate text-left flex items-center gap-1"
                >
                  <span>{message.from_name ? `${message.from_name} <${message.from_address}>` : message.from_address}</span>
                </button>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-neutral-400 w-16 flex-shrink-0">Đến:</span>
                <span className="text-neutral-700 dark:text-neutral-200 truncate">
                  {toAddresses.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ") || t("emailView.you")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-400 w-16 flex-shrink-0">Thời gian:</span>
                <span className="text-neutral-600 dark:text-neutral-300">{safeFormat(message.date)}</span>
              </div>
              {message.message_id && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-400 w-16 flex-shrink-0">ID:</span>
                  <span className="text-neutral-500 font-mono text-[11px] truncate">{message.message_id}</span>
                </div>
              )}
              {unsubscribeUrl && (
                <div className="flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/10">
                  <span className="font-semibold text-neutral-400 w-16 flex-shrink-0">Đăng ký:</span>
                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    className="text-xs font-semibold text-danger hover:underline flex items-center gap-1"
                  >
                    <BellOff size={13} />
                    <span>Mở liên kết Hủy đăng ký nhận thư</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {unsubscribeToast && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger font-medium animate-in fade-in duration-200">
            <span>{t("emailView.unsubscribeToast") ?? "Đã mở liên kết Hủy đăng ký trên trình duyệt."}</span>
            <button onClick={() => setUnsubscribeToast(false)} className="text-neutral-400 hover:text-neutral-600">
              <X size={13} />
            </button>
          </div>
        )}

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
          <HtmlMessageFrame html={message.body_html} overrideTheme={readingTheme} onToggleTheme={toggleReadingTheme} />
        ) : (
          <div
            className="rounded-xl p-4 transition-colors duration-200 border border-black/5 dark:border-white/5 relative group"
            style={
              readingTheme === "light"
                ? { backgroundColor: "#ffffff", color: "#1c1c1e" }
                : readingTheme === "dark"
                  ? { backgroundColor: "#1c1c1e", color: "#f2f2f7" }
                  : undefined
            }
          >
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={toggleReadingTheme}
                className="flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                title="Chuyển đổi nền sáng / tối"
              >
                {readingTheme === "dark" ? (
                  <>
                    <Sun size={13} className="text-amber-500" />
                    <span>Nền sáng</span>
                  </>
                ) : (
                  <>
                    <Moon size={13} className="text-indigo-400" />
                    <span>Nền tối</span>
                  </>
                )}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
              {message.body_text}
            </p>
          </div>
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
