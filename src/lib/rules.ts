import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import { toImapConnection } from "@/lib/connection";
import { extractPlainText } from "@/lib/text";
import type { Account, EmailMessage, FolderRow, RuleAction, RuleCondition, RuleRow } from "@/types/mail";

function fieldText(message: EmailMessage, field: RuleCondition["field"]): string {
  switch (field) {
    case "from":
      return `${message.from?.name ?? ""} ${message.from?.address ?? ""}`.toLowerCase();
    case "to":
      return message.to.map((a) => `${a.name ?? ""} ${a.address}`).join(" ").toLowerCase();
    case "subject":
      return message.subject.toLowerCase();
    case "body":
      return extractPlainText(message.bodyText, message.bodyHtml).toLowerCase();
  }
}

function matchesCondition(message: EmailMessage, condition: RuleCondition): boolean {
  const needle = condition.value.trim().toLowerCase();
  if (!needle) return false;
  const haystack = fieldText(message, condition.field);
  switch (condition.operator) {
    case "contains":
      return haystack.includes(needle);
    case "equals":
      return haystack.trim() === needle;
    case "starts_with":
      return haystack.trim().startsWith(needle);
  }
}

export function parseConditions(json: string): RuleCondition[] {
  try {
    return JSON.parse(json) as RuleCondition[];
  } catch {
    return [];
  }
}

export function parseActions(json: string): RuleAction[] {
  try {
    return JSON.parse(json) as RuleAction[];
  } catch {
    return [];
  }
}

export function matchesRule(message: EmailMessage, rule: RuleRow): boolean {
  const conditions = parseConditions(rule.conditions_json);
  if (conditions.length === 0) return false;
  return rule.match_type === "all"
    ? conditions.every((c) => matchesCondition(message, c))
    : conditions.some((c) => matchesCondition(message, c));
}

/**
 * Applies every enabled rule to a batch of messages that were just synced
 * for the first time (see `useMailStore.loadMessages`, which diffs against
 * the local cache before calling this). Re-running rules against messages
 * already seen would silently undo a user's own later edits — flagging a
 * message a rule flagged, then having the next sync re-flag it after the
 * user unflagged it — so callers must only pass genuinely new messages.
 */
export async function applyRulesToNewMessages(
  account: Account,
  folder: FolderRow,
  allFolders: FolderRow[],
  messages: EmailMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  const rules = (await repo.listRules(account.id)).filter((r) => r.enabled === 1);
  if (rules.length === 0) return;

  const connection = toImapConnection(account);

  for (const message of messages) {
    const cachedId = `${folder.id}:${message.uid}`;
    let movedTo: FolderRow | null = null;

    for (const rule of rules) {
      if (!matchesRule(message, rule)) continue;

      for (const action of parseActions(rule.actions_json)) {
        try {
          if (action.type === "mark_read") {
            await commands.imapSetFlag(connection, folder.path, message.uid, "\\Seen", true);
            await repo.setMessageReadState(cachedId, true);
          } else if (action.type === "flag") {
            await commands.imapSetFlag(connection, folder.path, message.uid, "\\Flagged", true);
            await repo.setMessageFlagged(cachedId, true);
          } else if (action.type === "add_label") {
            await repo.addLabelToMessage(cachedId, action.labelId);
          } else if (action.type === "move") {
            const destination = allFolders.find((f) => f.id === action.folderId);
            if (destination && !movedTo) {
              await commands.imapMoveMessage(connection, folder.path, message.uid, destination.path);
              await repo.deleteMessage(cachedId);
              movedTo = destination;
            }
          }
        } catch {
          // Best-effort: one failing action shouldn't block the rest of the rule set.
        }
      }

      // The message no longer lives in this folder — later rules in this
      // pass would act on a UID the server has already moved elsewhere.
      if (movedTo) break;
    }
  }
}
