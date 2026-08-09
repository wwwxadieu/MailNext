import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import * as repo from "@/lib/repository";
import { useAccountStore } from "@/store/useAccountStore";
import { useT } from "@/lib/useT";
import type { LabelRow } from "@/types/mail";

const PALETTE = ["#0A84FF", "#FF453A", "#FF9F0A", "#FFD60A", "#32D74B", "#64D2FF", "#BF5AF2", "#FF375F"];

export function LabelManager() {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [name, setName] = useState("");

  async function refresh() {
    if (!activeAccount) return;
    setLabels(await repo.listLabels(activeAccount.id));
  }

  useEffect(() => {
    void refresh();
  }, [activeAccount?.id]);

  async function handleCreate() {
    if (!activeAccount || !name.trim()) return;
    const color = PALETTE[labels.length % PALETTE.length]!;
    await repo.createLabel(activeAccount.id, name.trim(), color);
    setName("");
    await refresh();
  }

  async function handleRecolor(labelId: string, color: string) {
    await repo.updateLabelColor(labelId, color);
    await refresh();
  }

  async function handleDelete(labelId: string) {
    await repo.deleteLabel(labelId);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <TextField
          label={t("labels.newLabel")}
          placeholder={t("labels.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button variant="primary" onClick={handleCreate} disabled={!name.trim()}>
          <Plus size={14} strokeWidth={1.5} />
          {t("labels.add")}
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {labels.map((label) => (
          <div key={label.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">
            <div className="flex gap-1">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  aria-label={t("labels.setColor", { color })}
                  onClick={() => handleRecolor(label.id, color)}
                  className="h-4 w-4 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-neutral-900"
                  style={{
                    backgroundColor: color,
                    boxShadow: label.color === color ? `0 0 0 2px ${color}` : undefined,
                  }}
                />
              ))}
            </div>
            <span className="flex-1 truncate pl-2 text-sm text-neutral-700 dark:text-neutral-200">{label.name}</span>
            <button
              onClick={() => handleDelete(label.id)}
              aria-label={t("labels.delete", { name: label.name })}
              className="text-neutral-400 hover:text-danger"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        {labels.length === 0 && <p className="px-2 py-2 text-xs text-neutral-400">{t("labels.noLabels")}</p>}
      </div>
    </div>
  );
}
