import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import * as commands from "@/lib/commands";
import { useT } from "@/lib/useT";
import { providerLabel } from "@/lib/providerLabels";
import type { ImapConnection, Provider, SmtpConnection } from "@/types/mail";

interface ProviderAuthFlowProps {
  provider: Provider;
  onBack: () => void;
  onUseAppPassword: () => void;
  onConnected: (result: {
    email: string;
    displayName: string;
    imap: ImapConnection;
    smtp: SmtpConnection;
    accessToken: string;
    refreshToken: string | null;
    tokenExpiresAt: number | null;
  }) => void;
}

export function ProviderAuthFlow({ provider, onBack, onUseAppPassword, onConnected }: ProviderAuthFlowProps) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"idle" | "authorizing" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.includes("@") && displayName.trim().length > 0 && status === "idle";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setStatus("authorizing");
    try {
      const token = await commands.oauthAuthorize(provider);
      const defaults = await commands.getProviderDefaults(provider);
      if (!defaults.imap || !defaults.smtp) {
        throw new Error(`No known server settings for ${provider}.`);
      }

      const imap: ImapConnection = {
        server: defaults.imap,
        auth: { kind: "o_auth_bearer", username: email, accessToken: token.accessToken },
      };
      const smtp: SmtpConnection = {
        server: defaults.smtp,
        auth: { kind: "o_auth_bearer", username: email, accessToken: token.accessToken },
      };

      setStatus("verifying");
      await commands.imapTestConnection(imap);
      await commands.smtpTestConnection(smtp);

      onConnected({
        email,
        displayName,
        imap,
        smtp,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: token.expiresInSecs ? Date.now() + token.expiresInSecs * 1000 : null,
      });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {t("authFlow.back")}
      </button>

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {t("authFlow.title", { provider: providerLabel[provider] })}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t("authFlow.subtitle", { provider: providerLabel[provider] })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextField
          label={t("authFlow.yourName")}
          placeholder="Jordan Avery"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoFocus
        />
        <TextField
          label={t("authFlow.emailAddress", { provider: providerLabel[provider] })}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && (
          <p className="max-h-32 overflow-y-auto rounded-lg bg-danger/5 p-2 text-xs break-words text-danger">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={!canSubmit} className="mt-2">
          {status === "authorizing" && <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />}
          {status === "verifying" && <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />}
          {status === "idle" || status === "error"
            ? t("authFlow.continueWith", { provider: providerLabel[provider] })
            : status === "authorizing"
              ? t("authFlow.waiting")
              : t("authFlow.verifying")}
        </Button>

        <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          <ShieldCheck size={13} strokeWidth={1.5} />
          {t("authFlow.secured")}
        </p>

        <button
          type="button"
          onClick={onUseAppPassword}
          className="text-center text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {t("authFlow.useAppPassword", { provider: providerLabel[provider] })}
        </button>
      </form>
    </div>
  );
}
