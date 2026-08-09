import { useEffect, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useAccountStore } from "@/store/useAccountStore";
import { useUiStore } from "@/store/useUiStore";
import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import { toSmtpConnection } from "@/lib/connection";
import { useT } from "@/lib/useT";
import type { OutgoingAttachment, OutgoingMessage } from "@/types/mail";

export function ComposeModal() {
  const t = useT();
  const isComposing = useUiStore((s) => s.isComposing);
  const closeCompose = useUiStore((s) => s.closeCompose);
  const activeAccount = useAccountStore((s) => s.activeAccount());

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isComposing || !activeAccount) return;
    let cancelled = false;
    void repo.listSignatures(activeAccount.id).then((signatures) => {
      if (cancelled) return;
      const defaultSignature = signatures.find((s) => s.is_default === 1);
      if (defaultSignature?.content_text) {
        setBody((current) => (current ? current : `\n\n${defaultSignature.content_text}`));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isComposing, activeAccount?.id]);

  if (!isComposing) return null;

  function parseAddressList(value: string) {
    return value
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
      .map((address) => ({ name: null, address }));
  }

  async function handleAttach(files: FileList | null) {
    if (!files) return;
    const next: OutgoingAttachment[] = [];
    for (const file of Array.from(files)) {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      next.push({ filename: file.name, mimeType: file.type || "application/octet-stream", contentBase64: base64 });
    }
    setAttachments((current) => [...current, ...next]);
  }

  async function handleSend() {
    if (!activeAccount || !to.trim() || !subject.trim()) return;
    setSending(true);
    setError(null);
    try {
      const outgoing: OutgoingMessage = {
        from: { name: activeAccount.display_name, address: activeAccount.email },
        to: parseAddressList(to),
        cc: parseAddressList(cc),
        bcc: [],
        subject,
        bodyText: body,
        bodyHtml: `<div style="white-space:pre-wrap">${escapeHtml(body)}</div>`,
        inReplyTo: null,
        references: [],
        attachments,
      };
      await commands.smtpSend(toSmtpConnection(activeAccount), outgoing);
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
      setAttachments([]);
      closeCompose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div className="fixed bottom-6 right-6 z-50 w-[440px]">
      <div className="glass-panel-elevated flex flex-col rounded-2xl">
        <div className="flex items-center justify-between rounded-t-2xl border-b border-black/5 dark:border-white/10 px-4 py-2.5">
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{t("compose.title")}</span>
          <button onClick={closeCompose} aria-label={t("compose.close")} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col divide-y divide-black/5 dark:divide-white/10 px-4">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t("compose.to")}
            className="h-9 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
          />
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder={t("compose.cc")}
            className="h-9 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("compose.subject")}
            className="h-9 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
          />
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder={t("compose.bodyPlaceholder")}
          className="resize-none bg-transparent px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
        />

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {attachments.map((a, i) => (
              <span
                key={`${a.filename}-${i}`}
                className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-1 text-[11px] text-neutral-600 dark:text-neutral-300"
              >
                {a.filename}
              </span>
            ))}
          </div>
        )}

        {error && <p className="px-4 pb-2 text-xs text-danger">{error}</p>}

        <div className="flex items-center justify-between rounded-b-2xl border-t border-black/5 dark:border-white/10 px-4 py-2.5">
          <label className="flex cursor-pointer items-center gap-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <Paperclip size={16} strokeWidth={1.5} />
            <input type="file" multiple className="hidden" onChange={(e) => void handleAttach(e.target.files)} />
          </label>
          <button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim()}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {sending ? <Loader2 size={13} className="animate-spin" strokeWidth={1.5} /> : <Send size={13} strokeWidth={1.5} />}
            {t("compose.send")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
