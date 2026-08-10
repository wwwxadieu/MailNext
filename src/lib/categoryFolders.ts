import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import { toImapConnection } from "@/lib/connection";
import type { Account, EmailMessage, FolderRow, ImapConnection, SpecialUse } from "@/types/mail";

interface MessageTextContext {
  from: string;
  subject: string;
}

function messageContext(message: EmailMessage): MessageTextContext {
  return {
    from: `${message.from?.name ?? ""} ${message.from?.address ?? ""}`.toLowerCase(),
    subject: message.subject.toLowerCase(),
  };
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

interface CategoryDef {
  specialUse: SpecialUse;
  path: string;
  /** Heuristic sniff test for whether a message belongs in this category —
   * the same kind of sender/subject signal Gmail's own inbox tabs use.
   * This is intentionally *not* the user-facing Rules feature: it's a
   * built-in classifier baked into the sync pipeline, so it never shows up
   * as an editable/deletable Rule the way a user's own filters do.
   * Omitted for "junk" — real providers already flag spam server-side (see
   * `classify_special_use` in the Rust IMAP layer), and a client-side
   * keyword guess for spam is more likely to bury legitimate mail than
   * catch anything a provider's own filter missed (see `looksLikeJunk`
   * below, which is used only for the non-destructive "badge hint" in
   * EmailList — never for auto-filing). */
  matches?: (ctx: MessageTextContext) => boolean;
}

const CATEGORIES: CategoryDef[] = [
  { specialUse: "junk", path: "Junk" },
  {
    specialUse: "social",
    path: "Social",
    matches: (ctx) =>
      containsAny(ctx.from, [
        "facebookmail.com",
        "facebook.com",
        "instagram.com",
        "twitter.com",
        "x.com",
        "linkedin.com",
        "tiktok.com",
        "pinterest.com",
      ]),
  },
  {
    specialUse: "promotions",
    path: "Promotions",
    matches: (ctx) =>
      containsAny(ctx.subject, ["% off", "sale", "discount"]) ||
      containsAny(ctx.from, ["mailchimp", "hubspot", "klaviyo"]),
  },
  {
    specialUse: "shopping",
    path: "Shopping",
    matches: (ctx) =>
      containsAny(ctx.from, ["amazon.com", "shopee", "lazada", "tiki.vn", "ebay.com"]) ||
      containsAny(ctx.subject, ["order confirmation", "your order", "has shipped"]),
  },
];

// Loose spam signal words, checked only for the EmailList "badge hint" —
// never used to auto-file or auto-delete anything (see the comment on
// CategoryDef.matches above for why junk stays out of CATEGORIES itself).
const JUNK_HINT_KEYWORDS = [
  "viagra",
  "casino",
  "lottery",
  "bạn đã trúng",
  "trúng thưởng",
  "vay tiền nhanh",
  "miễn phí 100%",
  "click here now",
  "wire transfer",
  "crypto giveaway",
  "nạp tiền miễn phí",
  "làm giàu nhanh",
];

/**
 * Client-side "what kind of mail is this" hint for the EmailList badge —
 * reuses the same sender/subject heuristics as the automatic inbox-tab
 * filing above (`classifyAndFileNewMessages`), plus a loose junk-keyword
 * check for messages sitting outside the Junk folder. Purely advisory: it
 * never moves or deletes anything on its own, it only informs what
 * suggested action the badge offers the user.
 */
export function detectMessageCategoryHint(input: {
  fromName: string | null;
  fromAddress: string | null;
  subject: string;
  snippet?: string;
}): SpecialUse | null {
  const ctx: MessageTextContext = {
    from: `${input.fromName ?? ""} ${input.fromAddress ?? ""}`.toLowerCase(),
    subject: input.subject.toLowerCase(),
  };
  for (const category of CATEGORIES) {
    if (category.matches?.(ctx)) return category.specialUse;
  }
  const snippetLower = (input.snippet ?? "").toLowerCase();
  if (containsAny(ctx.subject, JUNK_HINT_KEYWORDS) || containsAny(snippetLower, JUNK_HINT_KEYWORDS)) {
    return "junk";
  }
  return null;
}

const PROVISIONED_KEY_PREFIX = "category_folders_provisioned:";

// Guards against two overlapping calls for the same account within a single
// app session — e.g. React StrictMode's intentional double-effect in dev,
// or a user switching accounts back and forth before the first call
// settles. Without this, both calls can read the "not yet provisioned"
// settings flag before either has a chance to write it, and each goes on
// to create its own duplicate set of folders.
const provisioningInFlight = new Set<string>();

/**
 * Creates the default Junk/Social/Promotions/Shopping folders the first
 * time an account's folders are loaded. Gated by a per-account settings
 * flag so it runs exactly once — after that, a user who deletes one of the
 * folders stays deleted rather than being recreated on every sync.
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
      await repo.createFolderRecord(account.id, category.path, category.path, category.specialUse);
      changed = true;
    }
    return changed;
  } finally {
    provisioningInFlight.delete(account.id);
  }
}

/**
 * Scans newly-arrived inbox mail and files anything that matches a
 * built-in category straight into its Social/Promotions/Shopping folder —
 * mirroring Gmail's own inbox tabs. This runs automatically as part of the
 * sync pipeline and is independent of the user's own Rules; it only ever
 * looks at mail landing in the inbox.
 */
export async function classifyAndFileNewMessages(
  account: Account,
  folder: FolderRow,
  allFolders: FolderRow[],
  messages: EmailMessage[],
): Promise<Set<number>> {
  const filed = new Set<number>();
  if (folder.special_use !== "inbox" || messages.length === 0) return filed;

  const connection = toImapConnection(account);

  // Group by destination first so each category folder gets one IMAP
  // session for all its matches, instead of reconnecting per message.
  const byDestination = new Map<string, { destination: FolderRow; uids: number[] }>();
  for (const message of messages) {
    const category = CATEGORIES.find((c) => c.matches?.(messageContext(message)));
    if (!category) continue;
    const destination = allFolders.find((f) => f.special_use === category.specialUse);
    if (!destination) continue;
    const entry = byDestination.get(destination.id);
    if (entry) {
      entry.uids.push(message.uid);
    } else {
      byDestination.set(destination.id, { destination, uids: [message.uid] });
    }
  }

  const messageIdsToDrop: string[] = [];
  for (const { destination, uids } of byDestination.values()) {
    try {
      await commands.imapMoveMessages(connection, folder.path, uids, destination.path);
      for (const uid of uids) {
        filed.add(uid);
        messageIdsToDrop.push(`${folder.id}:${uid}`);
      }
    } catch {
      // Best-effort — leave these in the inbox if the move fails.
    }
  }
  await repo.deleteMessages(messageIdsToDrop);
  return filed;
}
