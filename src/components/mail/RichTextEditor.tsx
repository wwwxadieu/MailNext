import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Table as TableIcon,
  Underline,
} from "lucide-react";
import clsx from "clsx";
import { useT } from "@/lib/useT";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeightClassName?: string;
}

const TRACKED_COMMANDS = [
  "bold",
  "italic",
  "underline",
  "strikeThrough",
  "insertUnorderedList",
  "insertOrderedList",
] as const;

const TABLE_HTML =
  '<table style="border-collapse:collapse;width:100%;margin:8px 0"><tbody>' +
  Array.from({ length: 3 })
    .map(
      () =>
        `<tr>${Array.from({ length: 3 })
          .map(() => '<td style="border:1px solid #c7c7cc;padding:6px 8px;min-width:60px">&nbsp;</td>')
          .join("")}</tr>`,
    )
    .join("") +
  "</tbody></table><p><br></p>";

/**
 * A minimal HTML rich-text editor — a `contentEditable` div driven by
 * `document.execCommand`, still broadly supported in Chromium/WebView2
 * despite being deprecated. This is intentionally WYSIWYG: the toolbar
 * buttons light up to show what formatting applies at the cursor, so
 * composing a formatted email never requires knowing any HTML — avoids
 * pulling in a full editor framework for what MailNext needs.
 */
export function RichTextEditor({ value, onChange, placeholder, autoFocus, minHeightClassName }: RichTextEditorProps) {
  const t = useT();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFocused = useRef(false);
  const [isEmpty, setIsEmpty] = useState(!value?.trim());
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});

  // Only push the `value` prop into the DOM when the editor isn't focused
  // (e.g. inserting a default signature before the user starts typing) —
  // otherwise every keystroke's onChange round-trip would reset the caret.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isFocused.current) return;
    if (el.innerHTML !== value) el.innerHTML = value;
    setIsEmpty(!el.textContent?.trim());
  }, [value]);

  // Reflect the formatting under the cursor on the toolbar itself, so a
  // reader who doesn't know HTML can still *see* — not guess — that
  // "bold" or "bulleted list" is active right now.
  useEffect(() => {
    function updateActiveStates() {
      const el = editorRef.current;
      const selection = window.getSelection();
      if (!el || !selection || selection.rangeCount === 0) return;
      if (!el.contains(selection.anchorNode)) return;
      const next: Record<string, boolean> = {};
      for (const command of TRACKED_COMMANDS) {
        try {
          next[command] = document.queryCommandState(command);
        } catch {
          next[command] = false;
        }
      }
      setActiveStates(next);
    }
    document.addEventListener("selectionchange", updateActiveStates);
    return () => document.removeEventListener("selectionchange", updateActiveStates);
  }, []);

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

  function handleImageFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") exec("insertImage", reader.result);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-black/5 dark:border-white/10 pb-1.5">
        <ToolbarButton label={t("compose.bold")} active={activeStates.bold} onClick={() => exec("bold")}>
          <Bold size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.italic")} active={activeStates.italic} onClick={() => exec("italic")}>
          <Italic size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.underline")} active={activeStates.underline} onClick={() => exec("underline")}>
          <Underline size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.strikethrough")} active={activeStates.strikeThrough} onClick={() => exec("strikeThrough")}>
          <Strikethrough size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
        <ToolbarButton label={t("compose.bulletList")} active={activeStates.insertUnorderedList} onClick={() => exec("insertUnorderedList")}>
          <List size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.numberedList")} active={activeStates.insertOrderedList} onClick={() => exec("insertOrderedList")}>
          <ListOrdered size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.blockquote")} onClick={() => exec("formatBlock", "blockquote")}>
          <Quote size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
        <ToolbarButton label={t("compose.link")} onClick={handleLink}>
          <Link2 size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.insertImage")} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t("compose.insertTable")} onClick={() => exec("insertHTML", TABLE_HTML)}>
          <TableIcon size={13} strokeWidth={1.75} />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageFile(e.target.files)}
        />
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
            "overflow-y-auto py-2 text-sm text-neutral-800 outline-none dark:text-neutral-100",
            "[&_a]:text-accent [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-500 [&_blockquote]:dark:text-neutral-400",
            "[&_img]:max-w-full [&_table]:max-w-full [&_td]:align-top",
            minHeightClassName ?? "min-h-[120px]",
          )}
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Prevent the editor from losing focus/selection before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent/15 text-accent"
          : "text-neutral-500 hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100",
      )}
    >
      {children}
    </button>
  );
}
