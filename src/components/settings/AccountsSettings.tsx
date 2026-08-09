import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AccountConnectFlow } from "@/components/onboarding/AccountConnectFlow";
import { useAccountStore } from "@/store/useAccountStore";
import { useT } from "@/lib/useT";

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  icloud: "iCloud",
  yahoo: "Yahoo Mail",
  custom: "Custom",
};

export function AccountsSettings() {
  const t = useT();
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
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
      <div className="flex flex-col gap-2">
        {accounts.map((account) => {
          const isActive = account.id === activeAccountId;
          return (
            <div
              key={account.id}
              className={clsx(
                "flex items-center gap-3 rounded-2xl p-3 border transition-all",
                isActive
                  ? "border-accent/40 bg-accent/5 dark:bg-accent/10 shadow-sm"
                  : "border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5",
              )}
            >
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: account.color }}
              >
                {account.display_name.charAt(0).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                    {account.display_name}
                  </p>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success flex-shrink-0">
                      <Check size={11} strokeWidth={2.5} />
                      {t("accounts.active") ?? "Đang sử dụng"}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {account.email} · {PROVIDER_LABELS[account.provider] ?? account.provider}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!isActive && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveAccount(account.id)}
                    className="text-xs px-2.5 py-1"
                  >
                    {t("accounts.switchTo") ?? "Chuyển dùng"}
                  </Button>
                )}
                <button
                  onClick={() => void handleRemove(account.id)}
                  disabled={removingId === account.id}
                  aria-label={t("accounts.remove", { email: account.email })}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-black/5 hover:text-danger disabled:opacity-40 dark:hover:bg-white/10 transition-colors"
                  title="Xóa tài khoản này"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          );
        })}
        {accounts.length === 0 && <p className="px-2.5 py-2 text-xs text-neutral-400">{t("accounts.noAccounts")}</p>}
      </div>

      <Button variant="secondary" size="sm" onClick={() => setAddingAccount(true)} className="w-fit mt-1">
        <Plus size={13} strokeWidth={1.5} />
        {t("accounts.addAccount")}
      </Button>

      <Modal open={addingAccount} onClose={() => setAddingAccount(false)} title={t("accounts.addAccountTitle")}>
        <AccountConnectFlow onComplete={() => setAddingAccount(false)} />
      </Modal>
    </div>
  );
}
