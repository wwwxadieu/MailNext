import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AccountConnectFlow } from "@/components/onboarding/AccountConnectFlow";
import { useAccountStore } from "@/store/useAccountStore";

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  icloud: "iCloud",
  yahoo: "Yahoo Mail",
  custom: "Custom",
};

export function AccountsSettings() {
  const accounts = useAccountStore((s) => s.accounts);
  const removeAccount = useAccountStore((s) => s.removeAccount);
  const [addingAccount, setAddingAccount] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(accountId: string) {
    setRemovingId(accountId);
    try {
      await removeAccount(accountId);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: account.color }}
            >
              {account.display_name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                {account.display_name}
              </p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {account.email} · {PROVIDER_LABELS[account.provider] ?? account.provider}
              </p>
            </div>
            <button
              onClick={() => handleRemove(account.id)}
              disabled={removingId === account.id}
              aria-label={`Remove ${account.email}`}
              className="flex-shrink-0 text-neutral-400 hover:text-danger disabled:opacity-40"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        {accounts.length === 0 && <p className="px-2.5 py-2 text-xs text-neutral-400">No accounts yet</p>}
      </div>

      <Button variant="secondary" size="sm" onClick={() => setAddingAccount(true)} className="w-fit">
        <Plus size={13} strokeWidth={1.5} />
        Add account
      </Button>

      <Modal open={addingAccount} onClose={() => setAddingAccount(false)} title="Add account">
        <AccountConnectFlow onComplete={() => setAddingAccount(false)} />
      </Modal>
    </div>
  );
}
