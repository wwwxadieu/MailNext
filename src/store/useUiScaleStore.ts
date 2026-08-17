import { create } from "zustand";
import { getSetting, setSetting } from "@/lib/repository";

export type UiScale = 90 | 100 | 110 | 125;

const SCALES: UiScale[] = [90, 100, 110, 125];

interface UiScaleState {
  scale: UiScale;
  hydrate: () => Promise<void>;
  setScale: (scale: UiScale) => Promise<void>;
}

function applyScale(scale: UiScale) {
  // Chromium's `zoom` (WebView2 on Windows) rescales px/rem-based sizing
  // consistently (unlike `transform: scale()`, which would leave blank
  // space or clip content at the edges) — but it does NOT rescale vh/vw:
  // those keep resolving against the real, unzoomed window size, so a
  // `100vh` box ends up rendered scale× taller than the actual window and
  // gets clipped. The app shell avoids vh/vw entirely (see index.css's
  // html/body/#root height:100%/width:100% cascade), but a few fixed-
  // position elements (the compose modal's corner-anchored positioning)
  // still need vh/vw for viewport-relative placement — --ui-scale lets
  // them divide it back out via calc(100vh / var(--ui-scale)).
  document.documentElement.style.zoom = `${scale}%`;
  document.documentElement.style.setProperty("--ui-scale", String(scale / 100));
}

export const useUiScaleStore = create<UiScaleState>((set) => ({
  scale: 100,

  hydrate: async () => {
    const stored = await getSetting("ui_scale");
    const parsed = stored ? (Number(stored) as UiScale) : 100;
    const scale = SCALES.includes(parsed) ? parsed : 100;
    applyScale(scale);
    set({ scale });
  },

  setScale: async (scale) => {
    applyScale(scale);
    set({ scale });
    await setSetting("ui_scale", String(scale));
  },
}));
