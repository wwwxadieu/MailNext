import { create } from "zustand";
import { getSetting, setSetting } from "@/lib/repository";
import type { Locale } from "@/lib/i18n";

interface LocaleState {
  locale: Locale;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
}

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",

  hydrate: async () => {
    const stored = (await getSetting("locale")) as Locale | null;
    const locale = stored === "vi" ? "vi" : "en";
    applyLocale(locale);
    set({ locale });
  },

  setLocale: async (locale) => {
    applyLocale(locale);
    set({ locale });
    await setSetting("locale", locale);
  },
}));
