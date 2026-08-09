import { check as checkForUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
  /** Rolling bytes/sec estimate, computed from recent progress chunks. */
  speedBps: number;
}

function toUpdateInfo(update: Update): UpdateInfo {
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body ?? null,
    date: update.date ?? null,
  };
}

/** Resolves to `null` when the app is already on the latest version. */
export async function checkForUpdates(): Promise<{ update: Update; info: UpdateInfo } | null> {
  const update = await checkForUpdate();
  if (!update) return null;
  return { update, info: toUpdateInfo(update) };
}

/**
 * Downloads and installs an update in place (no browser download, no manual
 * installer run) while reporting byte-level progress and a rolling download
 * speed. On Windows the NSIS updater installs silently in the background —
 * call {@link relaunch} once `onProgress` reports completion to apply it.
 */
export async function downloadAndInstall(
  update: Update,
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total: number | null = null;

  // Speed is a rolling average over the last ~1s window of progress chunks,
  // so it settles quickly but isn't jumpy between individual TCP reads.
  const windowMs = 1000;
  let windowStart = performance.now();
  let windowBytes = 0;
  let speedBps = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      windowBytes += event.data.chunkLength;

      const now = performance.now();
      const elapsed = now - windowStart;
      if (elapsed >= windowMs) {
        speedBps = (windowBytes / elapsed) * 1000;
        windowStart = now;
        windowBytes = 0;
      }
    } else if (event.event === "Finished") {
      speedBps = 0;
    }

    onProgress({ downloaded, total, speedBps });
  });
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}
