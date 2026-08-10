/**
 * Detects if an email contains an unsubscribe URL/mailto link in its body or text.
 */
export function extractUnsubscribeUrl(html: string | null, text: string | null): string | null {
  const content = html || text || "";
  if (!content) return null;

  // 1. Look for href link inside <a> tag with unsubscribe keywords
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(?:[^<]*?(?:unsubscribe|hủy đăng ký|opt-out|optout|bỏ đăng ký)[^<]*?)<\/a>/gi;
  let match = anchorRegex.exec(content);
  if (match?.[1]) {
    const url = match[1].replace(/&amp;/g, "&");
    if (url.startsWith("http") || url.startsWith("mailto:")) return url;
  }

  // 2. Look for any href link containing unsubscribe/optout in the URL itself
  const hrefRegex = /href=["'](https?:\/\/[^"']*(?:unsubscribe|optout|opt-out|list-unsubscribe)[^"']*)["']/gi;
  match = hrefRegex.exec(content);
  if (match?.[1]) {
    return match[1].replace(/&amp;/g, "&");
  }

  // 3. Fallback: plain text URL regex
  const textUrlRegex = /(https?:\/\/[^\s"'<>]*(?:unsubscribe|optout|opt-out|list-unsubscribe)[^\s"'<>]*)/gi;
  match = textUrlRegex.exec(content);
  if (match?.[1]) {
    return match[1];
  }

  return null;
}
