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
  // Chromium's `zoom` (WebView2 on Windows) rescales the whole render —
  // including how vh/vw resolve — so 100vh/100vw layouts stay correctly
  // filled, unlike `transform: scale()` which would leave blank space or
  // clip content at the edges.
  document.documentElement.style.zoom = `${scale}%`;
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
