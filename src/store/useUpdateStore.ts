import { create } from "zustand";
import type { Update } from "@tauri-apps/plugin-updater";
import * as updater from "@/lib/updater";
import type { DownloadProgress, UpdateInfo } from "@/lib/updater";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: DownloadProgress;
  error: string | null;
  lastCheckedAt: number | null;
  dismissed: boolean;

  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  restartNow: () => Promise<void>;
  dismiss: () => void;
}

let pendingUpdate: Update | null = null;

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  info: null,
  progress: { downloaded: 0, total: null, speedBps: 0 },
  error: null,
  lastCheckedAt: null,
  dismissed: false,

  checkForUpdates: async () => {
    if (get().status === "checking" || get().status === "downloading") return;
    set({ status: "checking", error: null });
    try {
      const result = await updater.checkForUpdates();
      set({ lastCheckedAt: Date.now() });
      if (!result) {
        set({ status: "up-to-date", info: null });
        return;
      }
      pendingUpdate = result.update;
      set({ status: "available", info: result.info, dismissed: false });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },

  installUpdate: async () => {
    if (!pendingUpdate) return;
    set({ status: "downloading", error: null, progress: { downloaded: 0, total: null, speedBps: 0 } });
    try {
      await updater.downloadAndInstall(pendingUpdate, (progress) => set({ progress }));
      set({ status: "ready" });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },

  restartNow: async () => {
    await updater.relaunchApp();
  },

  dismiss: () => set({ dismissed: true }),
}));
