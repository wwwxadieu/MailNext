import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import { toImapConnection } from "@/lib/connection";
import { useAccountStore } from "@/store/useAccountStore";
import { useMailStore } from "@/store/useMailStore";
import { useUiStore } from "@/store/useUiStore";

export function FolderModal() {
  const isOpen = useUiStore((s) => s.isFolderModalOpen);
  const close = useUiStore((s) => s.closeFolderModal);
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const folders = useMailStore((s) => s.folders);
  const loadFolders = useMailStore((s) => s.loadFolders);

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!activeAccount || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const connection = toImapConnection(activeAccount);
      await commands.imapCreateFolder(connection, name.trim());
      await loadFolders(activeAccount);
      setName("");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(folderId: string, path: string) {
    if (!activeAccount) return;
    setBusy(true);
    setError(null);
    try {
      const connection = toImapConnection(activeAccount);
      await commands.imapDeleteFolder(connection, path);
      await repo.deleteFolderRecord(folderId);
      await loadFolders(activeAccount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const customFolders = folders.filter((f) => !f.special_use);

  return (
    <Modal open={isOpen} onClose={close} title="Manage folders">
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <TextField
            label="New folder name"
            placeholder="Travel"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button variant="primary" disabled={busy || !name.trim()} onClick={handleCreate}>
            {busy && <Loader2 size={14} className="animate-spin" strokeWidth={1.5} />}
            Create
          </Button>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        {customFolders.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-black/5 dark:border-white/10 pt-3">
            <p className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">Your folders</p>
            {customFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="truncate text-sm text-neutral-700 dark:text-neutral-200">{folder.name}</span>
                <button
                  disabled={busy}
                  onClick={() => handleDelete(folder.id, folder.path)}
                  className="text-neutral-400 hover:text-danger disabled:opacity-40"
                  aria-label={`Delete ${folder.name}`}
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
