import { useState } from "react";
import { Mail } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ServiceGrid } from "@/components/onboarding/ServiceGrid";
import { ProviderAuthFlow } from "@/components/onboarding/ProviderAuthFlow";
import { PasswordProviderFlow } from "@/components/onboarding/PasswordProviderFlow";
import { useAccountStore } from "@/store/useAccountStore";
import type { ImapConnection, Provider, SmtpConnection } from "@/types/mail";

const ACCENT_COLORS = ["#0A84FF", "#FF9F0A", "#32D74B", "#FF453A", "#BF5AF2", "#64D2FF"];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [selected, setSelected] = useState<Provider | null>(null);
  const addAccount = useAccountStore((s) => s.addAccount);
  const accountCount = useAccountStore((s) => s.accounts.length);

  async function finish(input: {
    email: string;
    displayName: string;
    imap: ImapConnection;
    smtp: SmtpConnection;
    accessToken?: string;
    refreshToken?: string | null;
    tokenExpiresAt?: number | null;
  }) {
    await addAccount({
      email: input.email,
      displayName: input.displayName,
      provider: selected!,
      imapHost: input.imap.server.host,
      imapPort: input.imap.server.port,
      imapImplicitTls: input.imap.server.implicitTls,
      smtpHost: input.smtp.server.host,
      smtpPort: input.smtp.server.port,
      smtpImplicitTls: input.smtp.server.implicitTls,
      authType: input.accessToken ? "oauth2" : "password",
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? undefined,
      tokenExpiresAt: input.tokenExpiresAt ?? undefined,
      passwordSecret: input.imap.auth.kind === "password" ? input.imap.auth.password : undefined,
      color: ACCENT_COLORS[accountCount % ACCENT_COLORS.length]!,
    });
    onComplete();
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <GlassPanel elevated className="w-full max-w-md rounded-3xl p-8">
        {!selected && (
          <div className="flex flex-col gap-6">
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

            <ServiceGrid onSelect={setSelected} />

            <button
              onClick={() => setSelected("custom")}
              className="text-center text-sm font-medium text-accent hover:text-accent-hover"
            >
              Custom domain / enterprise email
            </button>
          </div>
        )}

        {selected && selected !== "icloud" && selected !== "custom" && (
          <ProviderAuthFlow provider={selected} onBack={() => setSelected(null)} onConnected={finish} />
        )}

        {selected && (selected === "icloud" || selected === "custom") && (
          <PasswordProviderFlow provider={selected} onBack={() => setSelected(null)} onConnected={finish} />
        )}
      </GlassPanel>
    </div>
  );
}
