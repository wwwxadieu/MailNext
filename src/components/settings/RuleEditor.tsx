import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import * as repo from "@/lib/repository";
import { parseActions, parseConditions } from "@/lib/rules";
import type { FolderRow, LabelRow, RuleAction, RuleCondition, RuleField, RuleOperator, RuleRow } from "@/types/mail";

const FIELD_LABELS: Record<RuleField, string> = {
  from: "From",
  to: "To",
  subject: "Subject",
  body: "Body",
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: "contains",
  equals: "is exactly",
  starts_with: "starts with",
};

function emptyCondition(): RuleCondition {
  return { field: "from", operator: "contains", value: "" };
}

interface RuleEditorProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  folders: FolderRow[];
  labels: LabelRow[];
  rule: RuleRow | null;
  onSaved: () => void;
}

export function RuleEditor({ open, onClose, accountId, folders, labels, rule, onSaved }: RuleEditorProps) {
  const [name, setName] = useState(rule?.name ?? "");
  const [matchType, setMatchType] = useState<"all" | "any">(rule?.match_type ?? "all");
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule ? parseConditions(rule.conditions_json) : [emptyCondition()],
  );
  const [actions, setActions] = useState<RuleAction[]>(rule ? parseActions(rule.actions_json) : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moveFolders = folders.filter((f) => f.special_use !== "sent" && f.special_use !== "drafts");

  function updateCondition(index: number, patch: Partial<RuleCondition>) {
    setConditions((current) => current.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function updateAction(index: number, next: RuleAction) {
    setActions((current) => current.map((a, i) => (i === index ? next : a)));
  }

  async function handleSave() {
    const cleanConditions = conditions.filter((c) => c.value.trim().length > 0);
    if (!name.trim() || cleanConditions.length === 0 || actions.length === 0) {
      setError("Give the rule a name, at least one condition with a value, and at least one action.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), matchType, conditions: cleanConditions, actions };
      if (rule) {
        await repo.updateRule(rule.id, input);
      } else {
        await repo.createRule(accountId, input);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={rule ? "Edit rule" : "New rule"} widthClassName="max-w-lg">
      <div className="flex flex-col gap-4">
        <TextField label="Rule name" placeholder="Newsletters to Archive" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Conditions</p>
            <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              Match
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as "all" | "any")}
                className="rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-1.5 py-0.5 text-xs text-neutral-800 dark:text-neutral-100"
              >
                <option value="all">all</option>
                <option value="any">any</option>
              </select>
              of the following
            </div>
          </div>

          {conditions.map((condition, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <select
                value={condition.field}
                onChange={(e) => updateCondition(index, { field: e.target.value as RuleField })}
                className="h-8 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 text-xs text-neutral-800 dark:text-neutral-100"
              >
                {(Object.keys(FIELD_LABELS) as RuleField[]).map((field) => (
                  <option key={field} value={field}>
                    {FIELD_LABELS[field]}
                  </option>
                ))}
              </select>
              <select
                value={condition.operator}
                onChange={(e) => updateCondition(index, { operator: e.target.value as RuleOperator })}
                className="h-8 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 text-xs text-neutral-800 dark:text-neutral-100"
              >
                {(Object.keys(OPERATOR_LABELS) as RuleOperator[]).map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
              <input
                value={condition.value}
                onChange={(e) => updateCondition(index, { value: e.target.value })}
                placeholder="value"
                className="h-8 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 text-xs text-neutral-800 placeholder:text-neutral-400 outline-none dark:text-neutral-100"
              />
              <button
                onClick={() => setConditions((current) => current.filter((_, i) => i !== index))}
                aria-label="Remove condition"
                className="flex-shrink-0 text-neutral-400 hover:text-danger"
              >
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          ))}

          <button
            onClick={() => setConditions((current) => [...current, emptyCondition()])}
            className="flex w-fit items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover"
          >
            <Plus size={12} strokeWidth={1.5} />
            Add condition
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t border-black/5 dark:border-white/10 pt-3">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Then do this</p>

          {actions.map((action, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <select
                value={action.type}
                onChange={(e) => {
                  const type = e.target.value as RuleAction["type"];
                  if (type === "move") updateAction(index, { type: "move", folderId: moveFolders[0]?.id ?? "" });
                  else if (type === "add_label") updateAction(index, { type: "add_label", labelId: labels[0]?.id ?? "" });
                  else updateAction(index, { type });
                }}
                className="h-8 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 text-xs text-neutral-800 dark:text-neutral-100"
              >
                <option value="move">Move to folder</option>
                <option value="mark_read">Mark as read</option>
                <option value="flag">Flag</option>
                <option value="add_label">Add label</option>
              </select>

              {action.type === "move" && (
                <select
                  value={action.folderId}
                  onChange={(e) => updateAction(index, { type: "move", folderId: e.target.value })}
                  className="h-8 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 text-xs text-neutral-800 dark:text-neutral-100"
                >
                  {moveFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}

              {action.type === "add_label" && (
                <select
                  value={action.labelId}
                  onChange={(e) => updateAction(index, { type: "add_label", labelId: e.target.value })}
                  className="h-8 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 text-xs text-neutral-800 dark:text-neutral-100"
                >
                  {labels.length === 0 && <option value="">No labels yet</option>}
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setActions((current) => current.filter((_, i) => i !== index))}
                aria-label="Remove action"
                className="flex-shrink-0 text-neutral-400 hover:text-danger"
              >
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          ))}

          <button
            onClick={() => setActions((current) => [...current, { type: "mark_read" }])}
            className="flex w-fit items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover"
          >
            <Plus size={12} strokeWidth={1.5} />
            Add action
          </button>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-black/5 dark:border-white/10 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            Save rule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
