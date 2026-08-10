import { Layers, Mail, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { useT } from "@/lib/useT";

interface WelcomeScreenProps {
  onContinue: () => void;
}

const FEATURES: { key: string; icon: LucideIcon; chip: string }[] = [
  { key: "sync", icon: RefreshCw, chip: "bg-accent/10 text-accent" },
  { key: "security", icon: ShieldCheck, chip: "bg-success/10 text-success" },
  { key: "rules", icon: SlidersHorizontal, chip: "bg-warning/10 text-warning" },
  { key: "accounts", icon: Layers, chip: "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400" },
];

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const t = useT();

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
      <div aria-hidden className="welcome-glow pointer-events-none absolute inset-0" />

      <div className="glass-panel-elevated welcome-card-in relative z-10 w-full max-w-[420px] rounded-[28px] bg-white/95 p-9 text-center shadow-2xl dark:bg-neutral-900/85">
        <div className="welcome-mark-in mx-auto mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-[19px] bg-gradient-to-br from-accent-hover to-accent shadow-[0_14px_26px_-10px_rgba(10,132,255,0.55)]">
          <Mail size={30} strokeWidth={1.75} className="text-white" />
        </div>

        <h1
          className="welcome-rise-in mb-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50"
          style={{ animationDelay: "0.1s" }}
        >
          {t("welcome.title")}
        </h1>
        <p
          className="welcome-rise-in mx-auto mb-7 max-w-[300px] text-[14.5px] leading-relaxed text-neutral-500 dark:text-neutral-400"
          style={{ animationDelay: "0.15s" }}
        >
          {t("welcome.subtitle")}
        </p>

        <div className="mb-7 flex flex-col gap-4 text-left">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.key}
              className="welcome-rise-in flex items-start gap-3.5"
              style={{ animationDelay: `${0.2 + i * 0.08}s` }}
            >
              <div
                className={clsx(
                  "flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px]",
                  feature.chip,
                )}
              >
                <feature.icon size={17} strokeWidth={2} />
              </div>
              <div className="min-w-0 pt-px">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t(`welcome.${feature.key}Title`)}
                </h2>
                <p className="text-[12.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {t(`welcome.${feature.key}Desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onContinue}
          className="welcome-rise-in flex w-full items-center justify-center rounded-[13px] bg-accent py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover"
          style={{ animationDelay: "0.5s" }}
        >
          {t("welcome.continue")}
        </button>
      </div>
    </div>
  );
}
