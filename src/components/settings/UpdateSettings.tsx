import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, DownloadCloud, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUpdateStore } from "@/store/useUpdateStore";
import { formatBytes, formatSpeed } from "@/lib/updater";

export function UpdateSettings() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const status = useUpdateStore((s) => s.status);
  const info = useUpdateStore((s) => s.info);
  const progress = useUpdateStore((s) => s.progress);
  const error = useUpdateStore((s) => s.error);
  const lastCheckedAt = useUpdateStore((s) => s.lastCheckedAt);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const installUpdate = useUpdateStore((s) => s.installUpdate);
  const restartNow = useUpdateStore((s) => s.restartNow);

  useEffect(() => {
    void getVersion().then(setCurrentVersion);
  }, []);

  const percent = progress.total ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100)) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
        <div>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">MailNext {currentVersion ?? "…"}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {lastCheckedAt
              ? `Last checked ${formatDistanceToNowStrict(lastCheckedAt, { addSuffix: true })}`
              : "Never checked for updates"}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={checkForUpdates}
          disabled={status === "checking" || status === "downloading"}
        >
          {status === "checking" ? (
            <Loader2 size={13} className="animate-spin" strokeWidth={1.5} />
          ) : (
            <RefreshCw size={13} strokeWidth={1.5} />
          )}
          Check for updates
        </Button>
      </div>

      {status === "up-to-date" && (
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <CheckCircle2 size={15} strokeWidth={1.5} className="text-success" />
          You're on the latest version
        </div>
      )}

      {status === "available" && info && (
        <div className="flex flex-col gap-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} strokeWidth={1.5} className="text-accent" />
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
              Version {info.version} is available
            </p>
          </div>
          {info.notes && (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              {info.notes}
            </p>
          )}
          <Button variant="primary" size="sm" onClick={installUpdate} className="w-fit">
            <DownloadCloud size={13} strokeWidth={1.5} />
            Download and install
          </Button>
        </div>
      )}

      {status === "downloading" && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Downloading update…</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: percent !== null ? `${percent}%` : "35%" }}
            />
          </div>
          <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {formatBytes(progress.downloaded)}
            {progress.total ? ` / ${formatBytes(progress.total)}` : ""}
            {percent !== null ? ` (${percent}%)` : ""}
            {progress.speedBps > 0 ? ` · ${formatSpeed(progress.speedBps)}` : ""}
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="flex items-center justify-between rounded-xl border border-success/20 bg-success/5 p-3">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
            Update installed — restart to finish
          </p>
          <Button variant="primary" size="sm" onClick={restartNow}>
            Restart now
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-3">
          <p className="text-sm font-medium text-danger">Update failed</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{error}</p>
        </div>
      )}

      <p className="text-[11px] text-neutral-400">
        Updates download in the background and install silently — no browser download, no installer wizard.
        You'll just need to restart MailNext once to apply an installed update.
      </p>
    </div>
  );
}
