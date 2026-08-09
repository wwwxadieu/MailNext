import * as repo from "@/lib/repository";
import { extractPlainText } from "@/lib/text";

const SEED_TEMPLATES: { name: string; subject: string; bodyHtml: string }[] = [
  {
    name: "Follow-up",
    subject: "Following up",
    bodyHtml:
      "<p>Hi,</p><p>Just following up on my last message — let me know if you had a chance to take a look.</p><p>Thanks!</p>",
  },
  {
    name: "Meeting request",
    subject: "Meeting request",
    bodyHtml:
      "<p>Hi,</p><p>Would you be available for a quick call this week? Let me know a couple of times that work for you.</p><p>Best,</p>",
  },
  {
    name: "Thank you",
    subject: "Thank you!",
    bodyHtml: "<p>Hi,</p><p>Thank you so much for your time and help — it's really appreciated.</p><p>Best,</p>",
  },
];

/** Gives every new account a few ready-to-use sample templates, so the
 * "Insert template" picker in Compose isn't empty on day one. Purely local
 * (no server round-trip needed), so this runs synchronously with account
 * creation rather than needing the provisioned-flag guard the IMAP-backed
 * default category folders use. */
export async function seedDefaultTemplates(accountId: string): Promise<void> {
  for (const seed of SEED_TEMPLATES) {
    await repo.createTemplate(accountId, {
      name: seed.name,
      subject: seed.subject,
      bodyHtml: seed.bodyHtml,
      bodyText: extractPlainText(null, seed.bodyHtml),
    });
  }
}
