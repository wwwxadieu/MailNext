import { DownloadCloud, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useUpdateStore } from "@/store/useUpdateStore";
import { formatBytes, formatSpeed } from "@/lib/updater";

export function UpdateBanner() {
  const status = useUpdateStore((s) => s.status);
  const info = useUpdateStore((s) => s.info);
  const progress = useUpdateStore((s) => s.progress);
  const error = useUpdateStore((s) => s.error);
  const dismissed = useUpdateStore((s) => s.dismissed);
  const installUpdate = useUpdateStore((s) => s.installUpdate);
  const restartNow = useUpdateStore((s) => s.restartNow);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const dismiss = useUpdateStore((s) => s.dismiss);

  if (status === "idle" || status === "checking" || status === "up-to-date") return null;
  if (dismissed && status !== "ready") return null;

  const percent = progress.total ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100)) : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-40 flex justify-center px-4">
      <div className="glass-panel-elevated pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-2xl px-4 py-3">
        {status === "available" && info && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Sparkles size={15} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                MailNext {info.version} is available
              </p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">You're on {info.currentVersion}</p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="flex-shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {status === "available" && (
          <button
            onClick={installUpdate}
            className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-accent text-xs font-medium text-white hover:bg-accent-hover"
          >
            <DownloadCloud size={13} strokeWidth={1.5} />
            Update now
          </button>
        )}

        {status === "downloading" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-accent" strokeWidth={1.5} />
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Downloading update…</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: percent !== null ? `${percent}%` : "35%" }}
              />
            </div>
            <p className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
              {formatBytes(progress.downloaded)}
              {progress.total ? ` / ${formatBytes(progress.total)}` : ""}
              {percent !== null ? ` · ${percent}%` : ""}
              {progress.speedBps > 0 ? ` · ${formatSpeed(progress.speedBps)}` : ""}
            </p>
          </div>
        )}

        {status === "ready" && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <RefreshCw size={15} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Update ready</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Restart MailNext to finish updating</p>
            </div>
            <button
              onClick={restartNow}
              className="flex-shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
            >
              Restart now
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-danger">Update failed</p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{error}</p>
            </div>
            <button
              onClick={checkForUpdates}
              className="flex-shrink-0 rounded-full bg-black/5 dark:bg-white/10 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-black/10 dark:text-neutral-200 dark:hover:bg-white/15"
            >
              Retry
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="flex-shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
