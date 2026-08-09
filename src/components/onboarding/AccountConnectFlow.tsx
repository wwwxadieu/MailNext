import { useState } from "react";
import type { ReactNode } from "react";
import { ServiceGrid } from "@/components/onboarding/ServiceGrid";
import { ProviderAuthFlow } from "@/components/onboarding/ProviderAuthFlow";
import { PasswordProviderFlow } from "@/components/onboarding/PasswordProviderFlow";
import { useAccountStore } from "@/store/useAccountStore";
import { useT } from "@/lib/useT";
import type { ImapConnection, Provider, SmtpConnection } from "@/types/mail";

const ACCENT_COLORS = ["#0A84FF", "#FF9F0A", "#32D74B", "#FF453A", "#BF5AF2", "#64D2FF"];

interface AccountConnectFlowProps {
  /** Rendered above the provider grid, only on the first step. */
  header?: ReactNode;
  onComplete: () => void;
}

/** Provider picker → OAuth/password flow → account creation. Shared by the
 * first-run Onboarding screen and the "Add account" flow in Settings. */
export function AccountConnectFlow({ header, onComplete }: AccountConnectFlowProps) {
  const t = useT();
  const [selected, setSelected] = useState<Provider | null>(null);
  const [useAppPassword, setUseAppPassword] = useState(false);
  const addAccount = useAccountStore((s) => s.addAccount);
  const accountCount = useAccountStore((s) => s.accounts.length);

  function selectProvider(provider: Provider) {
    setUseAppPassword(false);
    setSelected(provider);
  }

  function handlePasswordFlowBack() {
    if (useAppPassword) {
      setUseAppPassword(false);
    } else {
      setSelected(null);
    }
  }

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
    setSelected(null);
    setUseAppPassword(false);
    onComplete();
  }

  const showOAuthFlow = selected && !useAppPassword && selected !== "icloud" && selected !== "custom";
  const showPasswordFlow = selected && (useAppPassword || selected === "icloud" || selected === "custom");

  return (
    <div className="flex flex-col gap-6">
      {!selected && (
        <>
          {header}
          <ServiceGrid onSelect={selectProvider} />
          <button
            onClick={() => selectProvider("custom")}
            className="text-center text-sm font-medium text-accent hover:text-accent-hover"
          >
            {t("onboarding.customDomain")}
          </button>
        </>
      )}

      {showOAuthFlow && (
        <ProviderAuthFlow
          provider={selected!}
          onBack={() => setSelected(null)}
          onUseAppPassword={() => setUseAppPassword(true)}
          onConnected={finish}
        />
      )}

      {showPasswordFlow && (
        <PasswordProviderFlow provider={selected!} onBack={handlePasswordFlowBack} onConnected={finish} />
      )}
    </div>
  );
}
