import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import * as repo from "@/lib/repository";
import { useAccountStore } from "@/store/useAccountStore";
import type { SignatureRow } from "@/types/mail";

export function SignatureEditor() {
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contentText, setContentText] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = signatures.find((s) => s.id === selectedId) ?? null;

  async function refresh(preserveSelection = true) {
    if (!activeAccount) return;
    const list = await repo.listSignatures(activeAccount.id);
    setSignatures(list);
    if (!preserveSelection || !list.some((s) => s.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null);
    }
  }

  useEffect(() => {
    void refresh(false);
  }, [activeAccount?.id]);

  useEffect(() => {
    setName(selected?.name ?? "");
    setContentText(selected?.content_text ?? "");
  }, [selectedId]);

  async function handleCreate() {
    if (!activeAccount) return;
    const signature = await repo.createSignature(activeAccount.id, "New signature", "", "");
    await refresh();
    setSelectedId(signature.id);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await repo.updateSignature(selected.id, name, `<p>${contentText.replace(/\n/g, "<br />")}</p>`, contentText);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await repo.deleteSignature(id);
    if (selectedId === id) setSelectedId(null);
    await refresh(false);
  }

  async function handleSetDefault(id: string) {
    if (!activeAccount) return;
    await repo.setDefaultSignature(activeAccount.id, id);
    await refresh();
  }

  return (
    <div className="flex gap-4">
      <div className="w-40 flex-shrink-0">
        <Button variant="ghost" size="sm" className="mb-2 w-full justify-start" onClick={handleCreate}>
          <Plus size={13} strokeWidth={1.5} />
          New
        </Button>
        <div className="flex flex-col gap-0.5">
          {signatures.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                s.id === selectedId
                  ? "bg-accent/10 text-accent"
                  : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
              }`}
            >
              <span className="truncate">{s.name}</span>
              {s.is_default === 1 && <Check size={12} strokeWidth={2} className="flex-shrink-0" />}
            </button>
          ))}
          {signatures.length === 0 && <p className="px-2 py-2 text-xs text-neutral-400">No signatures yet</p>}
        </div>
      </div>

      {selected ? (
        <div className="flex flex-1 flex-col gap-3">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Content</label>
            <textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              rows={6}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 text-sm text-neutral-800 outline-none focus:ring-2 focus:ring-accent/40 dark:text-neutral-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin" strokeWidth={1.5} />}
              Save
            </Button>
            {selected.is_default !== 1 && (
              <Button variant="ghost" size="sm" onClick={() => handleSetDefault(selected.id)}>
                Set as default
              </Button>
            )}
            <Button variant="ghost" size="sm" className="ml-auto text-danger" onClick={() => handleDelete(selected.id)}>
              <Trash2 size={13} strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
          Select or create a signature
        </div>
      )}
    </div>
  );
}
