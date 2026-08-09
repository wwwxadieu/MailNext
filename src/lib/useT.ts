import { useCallback } from "react";
import { useLocaleStore } from "@/store/useLocaleStore";
import { translate } from "@/lib/i18n";

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
}
