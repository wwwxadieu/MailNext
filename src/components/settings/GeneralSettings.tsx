import { Globe, Moon, Sun, SunMoon } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/lib/useT";
import { LOCALE_LABELS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { useLocaleStore } from "@/store/useLocaleStore";
import { useThemeStore } from "@/store/useThemeStore";
import type { ThemePreference } from "@/store/useThemeStore";

const THEME_OPTIONS: { value: ThemePreference; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: SunMoon },
];

export function GeneralSettings() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Globe size={15} strokeWidth={1.5} className="text-accent" />
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{t("general.language")}</p>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("general.languageDescription")}</p>
        <div className="flex gap-1.5">
          {(Object.keys(LOCALE_LABELS) as Locale[]).map((value) => (
            <button
              key={value}
              onClick={() => void setLocale(value)}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                locale === value
                  ? "bg-accent text-white"
                  : "bg-black/5 text-neutral-600 hover:bg-black/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15",
              )}
            >
              {LOCALE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-black/5 dark:border-white/10 pt-4">
        <div className="flex items-center gap-2">
          <SunMoon size={15} strokeWidth={1.5} className="text-accent" />
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{t("general.appearance")}</p>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("general.appearanceDescription")}</p>
        <div className="flex gap-1.5">
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => void setPreference(value)}
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                preference === value
                  ? "bg-accent text-white"
                  : "bg-black/5 text-neutral-600 hover:bg-black/10 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15",
              )}
            >
              <Icon size={13} strokeWidth={1.5} />
              {t(`general.theme.${value}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
