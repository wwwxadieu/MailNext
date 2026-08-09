/** Best-effort plain text for a cached message, used when sending content to
 * the summarization API — prefers the stored plain-text part and falls back
 * to stripping tags from the HTML part via the browser's own HTML parser. */
export function extractPlainText(bodyText: string | null, bodyHtml: string | null): string {
  if (bodyText && bodyText.trim()) return bodyText.trim();
  if (bodyHtml && bodyHtml.trim()) {
    const doc = new DOMParser().parseFromString(bodyHtml, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  return "";
}
