import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { RichTextEditor } from "@/components/mail/RichTextEditor";
import * as repo from "@/lib/repository";
import { extractPlainText } from "@/lib/text";
import { useAccountStore } from "@/store/useAccountStore";
import { useT } from "@/lib/useT";
import type { TemplateRow } from "@/types/mail";

export function TemplateManager() {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = templates.find((t2) => t2.id === selectedId) ?? null;

  async function refresh(preserveSelection = true) {
    if (!activeAccount) return;
    const list = await repo.listTemplates(activeAccount.id);
    setTemplates(list);
    if (!preserveSelection || !list.some((t2) => t2.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null);
    }
  }

  useEffect(() => {
    void refresh(false);
  }, [activeAccount?.id]);

  useEffect(() => {
    setName(selected?.name ?? "");
    setSubject(selected?.subject ?? "");
    setBodyHtml(selected?.body_html ?? "");
  }, [selectedId]);

  async function handleCreate() {
    if (!activeAccount) return;
    const template = await repo.createTemplate(activeAccount.id, {
      name: t("templates.newTemplateName"),
      subject: "",
      bodyHtml: "",
      bodyText: "",
    });
    await refresh();
    setSelectedId(template.id);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await repo.updateTemplate(selected.id, {
        name,
        subject,
        bodyHtml,
        bodyText: extractPlainText(null, bodyHtml),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await repo.deleteTemplate(id);
    if (selectedId === id) setSelectedId(null);
    await refresh(false);
  }

  return (
    <div className="flex gap-4">
      <div className="w-40 flex-shrink-0">
        <Button variant="ghost" size="sm" className="mb-2 w-full justify-start" onClick={handleCreate}>
          <Plus size={13} strokeWidth={1.5} />
          {t("templates.new")}
        </Button>
        <div className="flex flex-col gap-0.5">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedId(template.id)}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                template.id === selectedId
                  ? "bg-accent/10 text-accent"
                  : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
              }`}
            >
              <span className="truncate">{template.name}</span>
            </button>
          ))}
          {templates.length === 0 && <p className="px-2 py-2 text-xs text-neutral-400">{t("templates.noTemplates")}</p>}
        </div>
      </div>

      {selected ? (
        <div className="flex flex-1 flex-col gap-3">
          <TextField label={t("templates.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label={t("templates.subject")} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("templates.content")}</label>
            <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3">
              <RichTextEditor value={bodyHtml} onChange={setBodyHtml} minHeightClassName="min-h-[140px]" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin" strokeWidth={1.5} />}
              {t("templates.save")}
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto text-danger" onClick={() => handleDelete(selected.id)}>
              <Trash2 size={13} strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
          {t("templates.selectOrCreate")}
        </div>
      )}
    </div>
  );
}
