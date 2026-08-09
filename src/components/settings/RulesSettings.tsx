import { useEffect, useState } from "react";
import { Filter, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { RuleEditor } from "@/components/settings/RuleEditor";
import * as repo from "@/lib/repository";
import { parseActions, parseConditions } from "@/lib/rules";
import { useAccountStore } from "@/store/useAccountStore";
import { useT } from "@/lib/useT";
import type { FolderRow, LabelRow, RuleAction, RuleCondition, RuleRow } from "@/types/mail";

function describeConditions(t: ReturnType<typeof useT>, rule: RuleRow): string {
  const conditions = parseConditions(rule.conditions_json);
  const operatorKey: Record<RuleCondition["operator"], string> = {
    contains: "rules.operator.contains",
    equals: "rules.operator.equals",
    starts_with: "rules.operator.startsWith",
  };
  const parts = conditions.map(
    (c) => `${t(`rules.field.${c.field}`)} ${t(operatorKey[c.operator])} "${c.value}"`,
  );
  return parts.join(rule.match_type === "all" ? ` ${t("rules.joinAnd")} ` : ` ${t("rules.joinOr")} `);
}

function describeActions(t: ReturnType<typeof useT>, actions: RuleAction[], folders: FolderRow[], labels: LabelRow[]): string {
  return actions
    .map((action) => {
      if (action.type === "mark_read") return t("rules.action.markRead");
      if (action.type === "flag") return t("rules.action.flag");
      if (action.type === "move") {
        return t("rules.action.move", { folder: folders.find((f) => f.id === action.folderId)?.name ?? t("rules.folderFallback") });
      }
      return t("rules.action.addLabel", { label: labels.find((l) => l.id === action.labelId)?.name ?? t("rules.labelFallback") });
    })
    .join(", ");
}

export function RulesSettings() {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [editing, setEditing] = useState<RuleRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    if (!activeAccount) return;
    const [ruleRows, folderRows, labelRows] = await Promise.all([
      repo.listRules(activeAccount.id),
      repo.listFolders(activeAccount.id),
      repo.listLabels(activeAccount.id),
    ]);
    setRules(ruleRows);
    setFolders(folderRows);
    setLabels(labelRows);
  }

  useEffect(() => {
    void refresh();
  }, [activeAccount?.id]);

  async function handleToggle(rule: RuleRow) {
    await repo.setRuleEnabled(rule.id, rule.enabled !== 1);
    await refresh();
  }

  async function handleDelete(ruleId: string) {
    await repo.deleteRule(ruleId);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={15} strokeWidth={1.5} className="text-accent" />
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{t("rules.title")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)} disabled={!activeAccount}>
          <Plus size={13} strokeWidth={1.5} />
          {t("rules.newRule")}
        </Button>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("rules.description")}</p>

      <div className="flex flex-col gap-1.5">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <div className="pt-0.5">
              <Switch checked={rule.enabled === 1} onChange={() => handleToggle(rule)} label={t("rules.enable", { name: rule.name })} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{rule.name}</p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {t("rules.if", {
                  conditions: describeConditions(t, rule),
                  actions: describeActions(t, parseActions(rule.actions_json), folders, labels),
                })}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={() => setEditing(rule)}
                aria-label={t("rules.edit", { name: rule.name })}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <Pencil size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => handleDelete(rule.id)}
                aria-label={t("rules.delete", { name: rule.name })}
                className="text-neutral-400 hover:text-danger"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="px-2 py-2 text-xs text-neutral-400">{t("rules.noRules")}</p>}
      </div>

      {activeAccount && (creating || editing) && (
        <RuleEditor
          open
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          accountId={activeAccount.id}
          folders={folders}
          labels={labels}
          rule={editing}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
