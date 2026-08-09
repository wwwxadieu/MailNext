import { useMemo, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

interface HtmlMessageFrameProps {
  html: string;
}

const FRAME_STYLE = `
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, "SF Pro Text", "Inter", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1c1c1e;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img { max-width: 100%; height: auto; }
    a { color: #0a84ff; }
    table { max-width: 100%; }
    @media (prefers-color-scheme: dark) {
      body { color: #f2f2f7; }
    }
  </style>
`;

/**
 * Renders untrusted HTML email bodies inside a sandboxed iframe (no
 * `allow-scripts`, no `allow-forms`, no `allow-top-navigation`) so embedded
 * `<script>` tags, inline event handlers and form submissions can never
 * execute — this is the same isolation strategy used by Gmail/Thunderbird.
 * Remote images are blocked until the reader explicitly opts in, to avoid
 * silently leaking read receipts to tracking pixels.
 */
export function HtmlMessageFrame({ html }: HtmlMessageFrameProps) {
  const [imagesAllowed, setImagesAllowed] = useState(false);
  const [height, setHeight] = useState(120);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasRemoteImages = useMemo(() => /<img[^>]+src\s*=\s*["']https?:/i.test(html), [html]);

  const srcDoc = useMemo(() => {
    const processed = imagesAllowed
      ? html
      : html.replace(/(<img[^>]+)\bsrc\s*=\s*(["'])(https?:)/gi, '$1data-blocked-src=$2$3');
    return `<!doctype html><html><head><meta charset="utf-8" />${FRAME_STYLE}</head><body>${processed}</body></html>`;
  }, [html, imagesAllowed]);

  return (
    <div className="flex flex-col gap-2">
      {hasRemoteImages && !imagesAllowed && (
        <button
          onClick={() => setImagesAllowed(true)}
          className="flex w-fit items-center gap-1.5 rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs text-neutral-500 hover:bg-black/10 dark:text-neutral-400 dark:hover:bg-white/15"
        >
          <ImageOff size={13} strokeWidth={1.5} />
          Images blocked — click to load
        </button>
      )}
      <iframe
        ref={iframeRef}
        title="Message body"
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
