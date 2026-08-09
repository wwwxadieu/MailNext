import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import * as commands from "@/lib/commands";
import type { ImapConnection, MailServerConfig, Provider, SmtpConnection } from "@/types/mail";

interface PasswordProviderFlowProps {
  provider: Provider;
  onBack: () => void;
  onConnected: (result: {
    email: string;
    displayName: string;
    imap: ImapConnection;
    smtp: SmtpConnection;
  }) => void;
}

export function PasswordProviderFlow({ provider, onBack, onConnected }: PasswordProviderFlowProps) {
  const isCustom = provider === "custom";

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    email.includes("@") &&
    displayName.trim().length > 0 &&
    password.length > 0 &&
    status === "idle" &&
    (!isCustom || (imapHost.trim() && smtpHost.trim()));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setStatus("verifying");
    try {
      let imapServer: MailServerConfig;
      let smtpServer: MailServerConfig;

      if (isCustom) {
        imapServer = { host: imapHost.trim(), port: Number(imapPort), implicitTls: Number(imapPort) === 993 };
        smtpServer = { host: smtpHost.trim(), port: Number(smtpPort), implicitTls: Number(smtpPort) === 465 };
      } else {
        const defaults = await commands.getProviderDefaults(provider);
        if (!defaults.imap || !defaults.smtp) throw new Error(`No known server settings for ${provider}.`);
        imapServer = defaults.imap;
        smtpServer = defaults.smtp;
      }

      const imap: ImapConnection = { server: imapServer, auth: { kind: "password", username: email, password } };
      const smtp: SmtpConnection = { server: smtpServer, auth: { kind: "password", username: email, password } };

      await commands.imapTestConnection(imap);
      await commands.smtpTestConnection(smtp);

      onConnected({ email, displayName, imap, smtp });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back
      </button>

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {isCustom ? "Add a custom or enterprise account" : "Sign in with an app-specific password"}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {isCustom
            ? "Enter your mail provider's IMAP and SMTP server details."
            : "iCloud Mail requires an app-specific password. Generate one at appleid.apple.com under Sign-In and Security."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextField label="Your name" placeholder="Jordan Avery" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
        <TextField label="Email address" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          label={isCustom ? "Password" : "App-specific password"}
          type="password"
          placeholder="••••••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {isCustom && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
            <TextField label="IMAP host" placeholder="imap.example.com" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
            <TextField label="IMAP port" inputMode="numeric" value={imapPort} onChange={(e) => setImapPort(e.target.value)} />
            <TextField label="SMTP host" placeholder="smtp.example.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            <TextField label="SMTP port" inputMode="numeric" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={!canSubmit} className="mt-2">
          {status === "verifying" && <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />}
          {status === "verifying" ? "Verifying account…" : "Connect account"}
        </Button>

        <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          <ShieldCheck size={13} strokeWidth={1.5} />
          Credentials are stored locally and never leave your device
        </p>
      </form>
    </div>
  );
}
