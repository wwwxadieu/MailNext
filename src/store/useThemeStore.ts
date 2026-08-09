import { create } from "zustand";
import { getSetting, setSetting } from "@/lib/repository";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeState {
  preference: ThemePreference;
  resolved: "light" | "dark";
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

function applyTheme(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: "system",
  resolved: resolveTheme("system"),

  hydrate: async () => {
    const stored = (await getSetting("theme")) as ThemePreference | null;
    const preference = stored ?? "system";
    const resolved = resolveTheme(preference);
    applyTheme(resolved);
    set({ preference, resolved });
  },

  setPreference: async (preference) => {
    const resolved = resolveTheme(preference);
    applyTheme(resolved);
    set({ preference, resolved });
    await setSetting("theme", preference);
  },
}));

if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { preference } = useThemeStore.getState();
    if (preference === "system") {
      const resolved = resolveTheme("system");
      applyTheme(resolved);
      useThemeStore.setState({ resolved });
    }
  });
}
