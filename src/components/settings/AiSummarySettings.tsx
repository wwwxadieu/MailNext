import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import * as commands from "@/lib/commands";

export function AiSummarySettings() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void commands.aiSummaryAvailable().then(setAvailable);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} strokeWidth={1.5} className="text-accent" />
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">AI email summaries</p>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Adds a "Summarize" action to every message, powered by Claude (Anthropic). No setup needed on your
        end — a message's subject and body are sent to Anthropic only when you click Summarize.
      </p>

      {available === true && (
        <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-neutral-700 dark:text-neutral-200">
          <CheckCircle2 size={15} strokeWidth={1.5} className="flex-shrink-0 text-success" />
          Ready — the Summarize button will work on any open message.
        </div>
      )}

      {available === false && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-neutral-700 dark:text-neutral-200">
          <XCircle size={15} strokeWidth={1.5} className="mt-0.5 flex-shrink-0 text-danger" />
          <div>
            <p>Not configured for this build.</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Whoever built MailNext needs to set the <code>MAILNEXT_ANTHROPIC_API_KEY</code> environment
              variable and rebuild — see the README's "AI email summaries" section.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
