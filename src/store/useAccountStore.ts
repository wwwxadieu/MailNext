import { create } from "zustand";
import * as repo from "@/lib/repository";
import { seedDefaultTemplates } from "@/lib/templateSeeds";
import type { Account } from "@/types/mail";

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addAccount: (input: repo.NewAccountInput) => Promise<Account>;
  removeAccount: (accountId: string) => Promise<void>;
  updateProfile: (accountId: string, displayName: string, color: string, avatarData?: string | null) => Promise<void>;
  setActiveAccount: (accountId: string) => void;
  activeAccount: () => Account | null;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  hydrated: false,

  hydrate: async () => {
    const accounts = await repo.listAccounts();
    set({
      accounts,
      activeAccountId: accounts[0]?.id ?? null,
      hydrated: true,
    });
  },

  addAccount: async (input) => {
    const account = await repo.createAccount(input);
    set((state) => ({
      accounts: [...state.accounts, account],
      activeAccountId: state.activeAccountId ?? account.id,
    }));
    void seedDefaultTemplates(account.id).catch(() => {
      // Best-effort — the account still works fine without sample templates.
    });
    return account;
  },

  removeAccount: async (accountId) => {
    await repo.deleteAccount(accountId);
    set((state) => {
      const accounts = state.accounts.filter((a) => a.id !== accountId);
      const activeAccountId =
        state.activeAccountId === accountId ? (accounts[0]?.id ?? null) : state.activeAccountId;
      return { accounts, activeAccountId };
    });
  },

  updateProfile: async (accountId, displayName, color, avatarData) => {
    const updated = await repo.updateAccountProfile(accountId, displayName, color, avatarData);
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === accountId ? updated : a)),
    }));
  },

  setActiveAccount: (accountId) => set({ activeAccountId: accountId }),

  activeAccount: () => {
    const { accounts, activeAccountId } = get();
    return accounts.find((a) => a.id === activeAccountId) ?? null;
  },
}));
