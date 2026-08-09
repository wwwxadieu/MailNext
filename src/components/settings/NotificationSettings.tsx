import { useEffect, useState } from "react";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { Play, ShieldAlert } from "lucide-react";
import clsx from "clsx";
import { Switch } from "@/components/ui/Switch";
import { getSetting, setSetting } from "@/lib/repository";
import { CHIME_LABELS, playChime } from "@/lib/sound";
import type { ChimeId } from "@/lib/sound";

export function NotificationSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [chime, setChime] = useState<ChimeId>("chime-1");
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    void Promise.all([
      getSetting("notifications_enabled"),
      getSetting("sound_enabled"),
      getSetting("sound_chime"),
      isPermissionGranted(),
    ]).then(([notif, sound, chimeSetting, granted]) => {
      setNotificationsEnabled(notif !== "false");
      setSoundEnabled(sound !== "false");
      setChime((chimeSetting as ChimeId) ?? "chime-1");
      setPermissionGranted(granted);
    });
  }, []);

  async function handleToggleNotifications(next: boolean) {
    if (next && permissionGranted === false) {
      const permission = await requestPermission();
      const granted = permission === "granted";
      setPermissionGranted(granted);
      if (!granted) return;
    }
    setNotificationsEnabled(next);
    await setSetting("notifications_enabled", String(next));
  }

  async function handleToggleSound(next: boolean) {
    setSoundEnabled(next);
    await setSetting("sound_enabled", String(next));
  }

  async function handleChimeSelect(next: ChimeId) {
    setChime(next);
    await setSetting("sound_chime", next);
    playChime(next);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Toast notifications</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Show a Windows notification when new mail arrives
          </p>
        </div>
        <Switch checked={notificationsEnabled} onChange={handleToggleNotifications} />
      </div>

      {permissionGranted === false && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          <ShieldAlert size={14} strokeWidth={1.5} />
          Notifications are blocked in Windows settings.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Sound</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Play a chime alongside notifications</p>
        </div>
        <Switch checked={soundEnabled} onChange={handleToggleSound} />
      </div>

      <div className={clsx("flex flex-col gap-1.5", !soundEnabled && "opacity-40 pointer-events-none")}>
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Chime</p>
        {(Object.keys(CHIME_LABELS) as ChimeId[]).map((id) => (
          <button
            key={id}
            onClick={() => handleChimeSelect(id)}
            className={clsx(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
              chime === id
                ? "bg-accent/10 text-accent"
                : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10",
            )}
          >
            <span>{CHIME_LABELS[id]}</span>
            <Play size={13} strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </div>
  );
}
