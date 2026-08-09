import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Underline } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/lib/useT";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeightClassName?: string;
}

/**
 * A minimal HTML rich-text editor — bold/italic/underline/lists/links over
 * a `contentEditable` div via `document.execCommand`. Still broadly
 * supported in Chromium/WebView2 despite being deprecated, and avoids
 * pulling in a full editor framework for what MailNext needs: composing an
 * actual HTML email body instead of plain text wrapped in a `<div>`.
 */
export function RichTextEditor({ value, onChange, placeholder, autoFocus, minHeightClassName }: RichTextEditorProps) {
  const t = useT();
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);
  const [isEmpty, setIsEmpty] = useState(!value?.trim());

  // Only push the `value` prop into the DOM when the editor isn't focused
  // (e.g. inserting a default signature before the user starts typing) —
  // otherwise every keystroke's onChange round-trip would reset the caret.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isFocused.current) return;
    if (el.innerHTML !== value) el.innerHTML = value;
    setIsEmpty(!el.textContent?.trim());
  }, [value]);

  function handleInput() {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
    setIsEmpty(!el.textContent?.trim());
  }

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  }

  function handleLink() {
    const url = window.prompt(t("compose.linkPrompt"));
    if (url && url.trim()) exec("createLink", url.trim());
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0.5 border-b border-black/5 dark:border-white/10 pb-1.5">
        <ToolbarButton label={t("compose.bold")} onClick={() => exec("bold")}>
          <Bold size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.italic")} onClick={() => exec("italic")}>
          <Italic size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.underline")} onClick={() => exec("underline")}>
          <Underline size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
        <ToolbarButton label={t("compose.bulletList")} onClick={() => exec("insertUnorderedList")}>
          <List size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.numberedList")} onClick={() => exec("insertOrderedList")}>
          <ListOrdered size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
        <ToolbarButton label={t("compose.link")} onClick={handleLink}>
          <Link2 size={13} strokeWidth={1.75} />
        </ToolbarButton>
      </div>

      <div className="relative">
        {isEmpty && placeholder && (
          <span className="pointer-events-none absolute left-0 top-2 text-sm text-neutral-400">{placeholder}</span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          autoFocus={autoFocus}
          onInput={handleInput}
          onFocus={() => {
            isFocused.current = true;
          }}
          onBlur={() => {
            isFocused.current = false;
          }}
          className={clsx(
            "overflow-y-auto py-2 text-sm text-neutral-800 outline-none dark:text-neutral-100 [&_a]:text-accent [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
            minHeightClassName ?? "min-h-[120px]",
          )}
        />
      </div>
    </div>
  );
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Prevent the editor from losing focus/selection before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
    >
      {children}
    </button>
  );
}
