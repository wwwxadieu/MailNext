import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, Paperclip, Send } from "lucide-react";
import { RichTextEditor } from "@/components/mail/RichTextEditor";
import { useAccountStore } from "@/store/useAccountStore";
import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import { toSmtpConnection } from "@/lib/connection";
import { extractPlainText } from "@/lib/text";
import { useT } from "@/lib/useT";
import type { OutgoingAttachment, OutgoingMessage, TemplateRow } from "@/types/mail";

export interface ComposeDraft {
  to: string;
  cc: string;
  subject: string;
  bodyHtml: string;
  attachments: OutgoingAttachment[];
}

interface ComposeFormProps {
  initialDraft?: Partial<ComposeDraft>;
  /** Called once the message has actually been sent. */
  onSent: () => void;
  /** Present only in the inline modal — hands the current draft off to a
   * detached window and lets the caller close the modal. Omitted inside
   * the detached window itself, since it can't detach further. */
  onDetach?: (draft: ComposeDraft) => void;
  bodyMinHeightClassName?: string;
  autoFocusBody?: boolean;
}

export function ComposeForm({ initialDraft, onSent, onDetach, bodyMinHeightClassName, autoFocusBody }: ComposeFormProps) {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());

  const [to, setTo] = useState(initialDraft?.to ?? "");
  const [cc, setCc] = useState(initialDraft?.cc ?? "");
  const [subject, setSubject] = useState(initialDraft?.subject ?? "");
  const [body, setBody] = useState(initialDraft?.bodyHtml ?? "");
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>(initialDraft?.attachments ?? []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    if (!activeAccount) return;
    let cancelled = false;
    if (!initialDraft?.bodyHtml) {
      void repo.listSignatures(activeAccount.id).then((signatures) => {
        if (cancelled) return;
        const defaultSignature = signatures.find((s) => s.is_default === 1);
        if (defaultSignature?.content_html) {
          setBody((current) => (current ? current : `<br><br>${defaultSignature.content_html}`));
        }
      });
    }
    void repo.listTemplates(activeAccount.id).then((list) => {
      if (!cancelled) setTemplates(list);
    });
    return () => {
      cancelled = true;
    };
    // Only re-run if the account itself changes — initialDraft is a one-time seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.id]);

  function applyTemplate(template: TemplateRow) {
    setTemplatesOpen(false);
    setSubject((current) => (current.trim() ? current : template.subject));
    setBody((current) => (current.trim() ? `${current}<br>${template.body_html}` : template.body_html));
  }

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
        bodyText: extractPlainText(null, body),
        bodyHtml: body,
        inReplyTo: null,
        references: [],
        attachments,
      };
      await commands.smtpSend(toSmtpConnection(activeAccount), outgoing);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
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

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <RichTextEditor
          value={body}
          onChange={setBody}
          placeholder={t("compose.bodyPlaceholder")}
          minHeightClassName={bodyMinHeightClassName ?? "min-h-[160px]"}
          autoFocus={autoFocusBody}
        />
      </div>

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

      <div className="flex flex-shrink-0 items-center justify-between rounded-b-2xl border-t border-black/5 dark:border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <Paperclip size={16} strokeWidth={1.5} />
            <input type="file" multiple className="hidden" onChange={(e) => void handleAttach(e.target.files)} />
          </label>
          <div className="relative">
            <button
              type="button"
              aria-label={t("compose.insertTemplate")}
              title={t("compose.insertTemplate")}
              onClick={() => setTemplatesOpen((v) => !v)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <FileText size={16} strokeWidth={1.5} />
            </button>
            {templatesOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTemplatesOpen(false)} />
                <div className="glass-panel-elevated absolute bottom-8 left-0 z-20 max-h-56 w-56 overflow-y-auto rounded-xl p-1.5">
                  {templates.length === 0 && (
                    <p className="px-2 py-2 text-xs text-neutral-400">{t("compose.noTemplates")}</p>
                  )}
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-black/5 dark:text-neutral-200 dark:hover:bg-white/10"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {onDetach && (
            <button
              type="button"
              aria-label={t("compose.detach")}
              title={t("compose.detach")}
              onClick={() => onDetach({ to, cc, subject, bodyHtml: body, attachments })}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <ExternalLink size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>
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
  );
}
