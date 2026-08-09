import { Mail } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { AccountConnectFlow } from "@/components/onboarding/AccountConnectFlow";

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <GlassPanel elevated className="w-full max-w-md rounded-3xl p-8">
        <AccountConnectFlow
          onComplete={onComplete}
          header={
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                <Mail size={26} strokeWidth={1.5} className="text-accent" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  Welcome to MailNext
                </h1>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Add an email account to get started
                </p>
              </div>
            </div>
          }
        />
      </GlassPanel>
    </div>
  );
}
