import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import * as commands from "@/lib/commands";
import { useT } from "@/lib/useT";

export function AiSummarySettings() {
  const t = useT();
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void commands.aiSummaryAvailable().then(setAvailable);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} strokeWidth={1.5} className="text-accent" />
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{t("aiSummary.title")}</p>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("aiSummary.description")}</p>

      {available === true && (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-neutral-700 dark:text-neutral-200">
          <CheckCircle2 size={15} strokeWidth={1.5} className="flex-shrink-0 text-success" />
          {t("aiSummary.ready")}
        </div>
      )}

      {available === false && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-neutral-700 dark:text-neutral-200">
          <XCircle size={15} strokeWidth={1.5} className="mt-0.5 flex-shrink-0 text-danger" />
          <div>
            <p>{t("aiSummary.notConfigured")}</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t("aiSummary.notConfiguredHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
