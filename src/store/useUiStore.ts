import { create } from "zustand";

export type SettingsPanel = "signatures" | "labels" | "notifications" | "updates" | null;

interface UiState {
  isComposing: boolean;
  composeInReplyTo: string | null;
  settingsPanel: SettingsPanel;
  isFolderModalOpen: boolean;

  openCompose: (inReplyTo?: string) => void;
  closeCompose: () => void;
  openSettings: (panel: SettingsPanel) => void;
  closeSettings: () => void;
  openFolderModal: () => void;
  closeFolderModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isComposing: false,
  composeInReplyTo: null,
  settingsPanel: null,
  isFolderModalOpen: false,

  openCompose: (inReplyTo) => set({ isComposing: true, composeInReplyTo: inReplyTo ?? null }),
  closeCompose: () => set({ isComposing: false, composeInReplyTo: null }),
  openSettings: (panel) => set({ settingsPanel: panel ?? "signatures" }),
  closeSettings: () => set({ settingsPanel: null }),
  openFolderModal: () => set({ isFolderModalOpen: true }),
  closeFolderModal: () => set({ isFolderModalOpen: false }),
}));
