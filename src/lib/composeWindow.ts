import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { ComposeDraft } from "@/components/mail/ComposeForm";

const HANDOFF_KEY = "mailnext:compose-handoff";

/**
 * Opens a standalone "New message" window. When a draft is passed (the
 * user detaching an in-progress compose from the small modal), it's
 * handed to the new window via `localStorage` — all of MailNext's windows
 * are served from the same origin under Tauri's app protocol, so this is
 * simpler and more reliable than choreographing a cross-window event
 * exchange around window-creation timing.
 */
export async function openComposeWindow(draft?: ComposeDraft): Promise<void> {
  if (draft) {
    window.localStorage.setItem(HANDOFF_KEY, JSON.stringify(draft));
  } else {
    window.localStorage.removeItem(HANDOFF_KEY);
  }

  const label = `compose-${crypto.randomUUID()}`;
  const webview = new WebviewWindow(label, {
    url: "index.html?window=compose",
    title: "New message",
    width: 720,
    height: 640,
    minWidth: 480,
    minHeight: 420,
    decorations: false,
    transparent: true,
    shadow: true,
    center: true,
  });

  await new Promise<void>((resolve) => {
    webview.once("tauri://created", () => resolve());
    webview.once("tauri://error", () => resolve());
  });
}

/** Reads (and clears) a draft handed off from the main window. Returns
 * `null` for an ordinary "New message" window with nothing to restore. */
export function takeComposeHandoff(): ComposeDraft | null {
  const raw = window.localStorage.getItem(HANDOFF_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(HANDOFF_KEY);
  try {
    return JSON.parse(raw) as ComposeDraft;
  } catch {
    return null;
  }
}
