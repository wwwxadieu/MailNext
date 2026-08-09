import { useMemo, useRef, useState } from "react";
import { ImageOff, Moon, Sun } from "lucide-react";
import { useT } from "@/lib/useT";
import { useThemeStore } from "@/store/useThemeStore";

interface HtmlMessageFrameProps {
  html: string;
  overrideTheme?: "light" | "dark" | "auto" | null;
  onToggleTheme?: () => void;
}

function frameStyle(isDark: boolean): string {
  return `
  <style>
    :root { color-scheme: ${isDark ? "dark" : "light"}; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, "SF Pro Text", "Inter", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: ${isDark ? "#f2f2f7" : "#1c1c1e"};
      background-color: ${isDark ? "#1c1c1e" : "#ffffff"};
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img { max-width: 100%; height: auto; }
    a { color: #0a84ff; }
    table { max-width: 100%; }
  </style>
`;
}

/**
 * Renders untrusted HTML email bodies inside a sandboxed iframe (no
 * `allow-scripts`, no `allow-forms`, no `allow-top-navigation`) so embedded
 * `<script>` tags, inline event handlers and form submissions can never
 * execute — this is the same isolation strategy used by Gmail/Thunderbird.
 * Remote images are blocked until the reader explicitly opts in, to avoid
 * silently leaking read receipts to tracking pixels.
 */
export function HtmlMessageFrame({ html, overrideTheme, onToggleTheme }: HtmlMessageFrameProps) {
  const t = useT();
  const appIsDark = useThemeStore((s) => s.resolved === "dark");
  const isDark = overrideTheme === "light" ? false : overrideTheme === "dark" ? true : appIsDark;

  const [imagesAllowed, setImagesAllowed] = useState(false);
  const [height, setHeight] = useState(120);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasRemoteImages = useMemo(() => /<img[^>]+src\s*=\s*["']https?:/i.test(html), [html]);

  const srcDoc = useMemo(() => {
    const processed = imagesAllowed
      ? html
      : html.replace(/(<img[^>]+)\bsrc\s*=\s*(["'])(https?:)/gi, "$1data-blocked-src=$2$3");
    return `<!doctype html><html><head><meta charset="utf-8" />${frameStyle(isDark)}</head><body>${processed}</body></html>`;
  }, [html, imagesAllowed, isDark]);

  return (
    <div
      className="flex flex-col gap-2 transition-colors duration-200 rounded-xl overflow-hidden p-1.5 border border-black/5 dark:border-white/5"
      style={{ backgroundColor: isDark ? "#1c1c1e" : "#ffffff" }}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1">
        {hasRemoteImages && !imagesAllowed ? (
          <button
            type="button"
            onClick={() => setImagesAllowed(true)}
            className="flex items-center gap-1.5 rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs text-neutral-500 hover:bg-black/10 dark:text-neutral-400 dark:hover:bg-white/15 transition-colors"
          >
            <ImageOff size={13} strokeWidth={1.5} />
            {t("emailView.imagesBlocked")}
          </button>
        ) : (
          <div />
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/20 transition-colors ml-auto"
            title="Chuyển đổi nền sáng / tối cho nội dung thư"
          >
            {isDark ? (
              <>
                <Sun size={13} className="text-amber-500" />
                <span>Nền sáng</span>
              </>
            ) : (
              <>
                <Moon size={13} className="text-indigo-400" />
                <span>Nền tối</span>
              </>
            )}
          </button>
        )}
      </div>

      <iframe
        ref={iframeRef}
        title={t("emailView.messageBodyTitle")}
        srcDoc={srcDoc}
        sandbox="allow-same-origin allow-popups"
        style={{ height }}
        className="w-full border-0"
        onLoad={() => {
          const doc = iframeRef.current?.contentDocument;
          if (doc?.documentElement) {
            setHeight(doc.documentElement.scrollHeight + 8);
          }
        }}
      />
    </div>
  );
}
