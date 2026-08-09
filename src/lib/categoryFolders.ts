import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import type { Account, FolderRow, ImapConnection, RuleCondition, SpecialUse } from "@/types/mail";

interface CategoryDef {
  specialUse: SpecialUse;
  path: string;
  /** Rule name + conditions that make a heuristic call about what belongs
   * in this category. Omitted for "junk" — real providers already flag
   * spam server-side (see `classify_special_use` in the Rust IMAP layer),
   * and a client-side keyword guess for spam is more likely to bury
   * legitimate mail than catch anything a provider's own filter missed. */
  rule?: { name: string; conditions: RuleCondition[] };
}

const CATEGORIES: CategoryDef[] = [
  { specialUse: "junk", path: "Junk" },
  {
    specialUse: "social",
    path: "Social",
    rule: {
      name: "Social",
      conditions: [
        { field: "from", operator: "contains", value: "facebookmail.com" },
        { field: "from", operator: "contains", value: "facebook.com" },
        { field: "from", operator: "contains", value: "instagram.com" },
        { field: "from", operator: "contains", value: "twitter.com" },
        { field: "from", operator: "contains", value: "x.com" },
        { field: "from", operator: "contains", value: "linkedin.com" },
        { field: "from", operator: "contains", value: "tiktok.com" },
        { field: "from", operator: "contains", value: "pinterest.com" },
      ],
    },
  },
  {
    specialUse: "promotions",
    path: "Promotions",
    rule: {
      name: "Promotions",
      conditions: [
        { field: "subject", operator: "contains", value: "% off" },
        { field: "subject", operator: "contains", value: "sale" },
        { field: "subject", operator: "contains", value: "discount" },
        { field: "from", operator: "contains", value: "mailchimp" },
        { field: "from", operator: "contains", value: "hubspot" },
        { field: "from", operator: "contains", value: "klaviyo" },
      ],
    },
  },
  {
    specialUse: "shopping",
    path: "Shopping",
    rule: {
      name: "Shopping",
      conditions: [
        { field: "from", operator: "contains", value: "amazon.com" },
        { field: "from", operator: "contains", value: "shopee" },
        { field: "from", operator: "contains", value: "lazada" },
        { field: "from", operator: "contains", value: "tiki.vn" },
        { field: "from", operator: "contains", value: "ebay.com" },
        { field: "subject", operator: "contains", value: "order confirmation" },
        { field: "subject", operator: "contains", value: "your order" },
        { field: "subject", operator: "contains", value: "has shipped" },
      ],
    },
  },
];

const PROVISIONED_KEY_PREFIX = "category_folders_provisioned:";

// Guards against two overlapping calls for the same account within a single
// app session — e.g. React StrictMode's intentional double-effect in dev,
// or a user switching accounts back and forth before the first call
// settles. Without this, both calls can read the "not yet provisioned"
// settings flag before either has a chance to write it, and each goes on
// to create its own duplicate set of folders and rules.
const provisioningInFlight = new Set<string>();

/**
 * Creates the default Junk/Social/Promotions/Shopping folders (and, for the
 * three heuristic categories, a starter Rule that routes new mail into
 * them) the first time an account's folders are loaded. Gated by a
 * per-account settings flag so it runs exactly once — after that, a user
 * who deletes the folder or rule stays deleted rather than being
 * recreated on every sync.
 */
export async function ensureDefaultCategoryFolders(
  account: Account,
  connection: ImapConnection,
  existingFolders: FolderRow[],
): Promise<boolean> {
  const flagKey = `${PROVISIONED_KEY_PREFIX}${account.id}`;

  // Claim the in-memory slot synchronously, with no `await` between the
  // check and the claim — otherwise two overlapping calls (React
  // StrictMode's double-effect in dev, rapid account switching) can both
  // pass the check before either has a chance to claim it.
  if (provisioningInFlight.has(account.id)) return false;
  provisioningInFlight.add(account.id);

  try {
    if ((await repo.getSetting(flagKey)) === "true") return false;
    // Claim the persisted flag too, before doing any work, so a concurrent
    // call from a *future* session sees it's already spoken for rather
    // than racing to provision a second copy.
    await repo.setSetting(flagKey, "true");

    let changed = false;
    for (const category of CATEGORIES) {
      if (existingFolders.some((f) => f.special_use === category.specialUse)) continue;
      try {
        await commands.imapCreateFolder(connection, category.path);
      } catch {
        continue; // Server rejected the folder (permissions, duplicate name, etc.) — leave it be.
      }
      const folder = await repo.createFolderRecord(account.id, category.path, category.path, category.specialUse);
      changed = true;

      if (category.rule) {
        await repo.createRule(account.id, {
          name: category.rule.name,
          matchType: "any",
          conditions: category.rule.conditions,
          actions: [{ type: "move", folderId: folder.id }],
        });
      }
    }
    return changed;
  } finally {
    provisioningInFlight.delete(account.id);
  }
}
