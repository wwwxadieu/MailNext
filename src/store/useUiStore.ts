import { create } from "zustand";

export type SettingsPanel =
  | "general"
  | "accounts"
  | "signatures"
  | "templates"
  | "labels"
  | "rules"
  | "notifications"
  | "updates"
  | "backup"
  | null;

interface UiState {
  isComposing: boolean;
  composeInReplyTo: string | null;
  composeRecipient: string | null;
  settingsPanel: SettingsPanel;
  isFolderModalOpen: boolean;
  isReadingPaneExpanded: boolean;

  openCompose: (inReplyTo?: string, recipient?: string) => void;
  closeCompose: () => void;
  openSettings: (panel: SettingsPanel) => void;
  closeSettings: () => void;
  openFolderModal: () => void;
  closeFolderModal: () => void;
  toggleReadingPaneExpanded: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isComposing: false,
  composeInReplyTo: null,
  composeRecipient: null,
  settingsPanel: null,
  isFolderModalOpen: false,
  isReadingPaneExpanded: false,

  openCompose: (inReplyTo, recipient) =>
    set({ isComposing: true, composeInReplyTo: inReplyTo ?? null, composeRecipient: recipient ?? null }),
  closeCompose: () => set({ isComposing: false, composeInReplyTo: null, composeRecipient: null }),
  openSettings: (panel) => set({ settingsPanel: panel ?? "accounts" }),
  closeSettings: () => set({ settingsPanel: null }),
  openFolderModal: () => set({ isFolderModalOpen: true }),
  closeFolderModal: () => set({ isFolderModalOpen: false }),
  toggleReadingPaneExpanded: () => set((s) => ({ isReadingPaneExpanded: !s.isReadingPaneExpanded })),
}));
