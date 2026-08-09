import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { getSetting, setSetting } from "@/lib/repository";
import * as commands from "@/lib/commands";

export function AiSummarySettings() {
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "testing" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSetting("anthropic_api_key").then((value) => {
      setSavedKey(value);
      setApiKey(value ?? "");
    });
  }, []);

  async function handleSave() {
    setStatus("testing");
    setError(null);
    try {
      if (apiKey.trim()) {
        await commands.summarizeEmail(apiKey.trim(), "Test", "This is a short test message to verify the API key works.");
      }
      await setSetting("anthropic_api_key", apiKey.trim());
      setSavedKey(apiKey.trim());
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const dirty = apiKey !== (savedKey ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} strokeWidth={1.5} className="text-accent" />
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">AI email summaries</p>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Adds a "Summarize" action to every message, powered by Claude (Anthropic). Requires your own Anthropic API
        key — get one at{" "}
        <span className="text-neutral-700 dark:text-neutral-300">console.anthropic.com</span>. The subject and body
        of a message are sent to Anthropic only when you click Summarize.
      </p>

      <div className="flex items-end gap-2">
        <TextField
          label="Anthropic API key"
          type={reveal ? "text" : "password"}
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setStatus("idle");
          }}
          className="flex-1"
        />
        <Button variant="ghost" size="md" onClick={() => setReveal((v) => !v)} aria-label="Toggle visibility">
          {reveal ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
        </Button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {status === "saved" && !dirty && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check size={13} strokeWidth={1.5} />
          Key saved and verified
        </p>
      )}

      <Button variant="primary" size="sm" onClick={handleSave} disabled={status === "testing" || !dirty} className="w-fit">
        {status === "testing" && <Loader2 size={13} className="animate-spin" strokeWidth={1.5} />}
        {status === "testing" ? "Verifying…" : "Save key"}
      </Button>

      <p className="text-[11px] text-neutral-400">
        Summaries use Claude Haiku — fast and inexpensive, well suited to short per-message summaries. Usage is
        billed to your own Anthropic account.
      </p>
    </div>
  );
}
