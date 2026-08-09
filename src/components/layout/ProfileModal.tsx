import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, User, X } from "lucide-react";
import { useAccountStore } from "@/store/useAccountStore";
import { useT } from "@/lib/useT";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#0A84FF", // Apple Blue
  "#30D158", // Green
  "#FF9F0A", // Orange
  "#FF375F", // Pink
  "#BF5AF2", // Purple
  "#64D2FF", // Cyan
  "#FFD60A", // Yellow
];

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const updateProfile = useAccountStore((s) => s.updateProfile);

  const [displayName, setDisplayName] = useState(activeAccount?.display_name ?? "");
  const [selectedColor, setSelectedColor] = useState(activeAccount?.color ?? "#0A84FF");
  const [avatarData, setAvatarData] = useState<string | null>(activeAccount?.avatar_data ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !activeAccount) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t("profile.imageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!displayName.trim()) return;
    setIsSaving(true);
    try {
      await updateProfile(activeAccount!.id, displayName.trim(), selectedColor, avatarData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="glass-panel-elevated relative w-[420px] max-w-full overflow-hidden rounded-2xl border border-black/15 bg-white/95 p-6 shadow-2xl dark:border-white/15 dark:bg-neutral-900/95">
        <div className="flex items-center justify-between border-b border-black/10 pb-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t("profile.editTitle")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-neutral-400 hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="relative group">
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full shadow-inner text-white font-semibold text-2xl"
              style={{ backgroundColor: selectedColor }}
            >
              {avatarData ? (
                <img src={avatarData} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span>{displayName.trim()[0]?.toUpperCase() || <User size={32} />}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 text-white"
              title={t("profile.changeAvatar")}
            >
              <Camera size={20} strokeWidth={1.5} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {avatarData && (
            <button
              onClick={() => setAvatarData(null)}
              className="text-xs font-medium text-danger hover:underline"
            >
              {t("profile.removeAvatar")}
            </button>
          )}

          <div className="w-full space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                {t("profile.displayName")}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm font-medium text-neutral-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-white/5 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                {t("profile.email")}
              </label>
              <input
                type="text"
                disabled
                value={activeAccount.email}
                className="w-full rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-neutral-400 outline-none dark:border-white/10 dark:bg-white/[0.03]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                {t("profile.badgeColor")}
              </label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  >
                    {selectedColor === c && <Check size={14} className="text-white" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-black/10 pt-4 dark:border-white/10">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
          >
            {t("app.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !displayName.trim()}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-50"
          >
            {t("app.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
