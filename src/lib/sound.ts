// Notification chimes are synthesized on the fly with the Web Audio API
// rather than shipped as static audio assets, so there is nothing to bundle
// and every chime scales cleanly with system volume/output device changes.

export type ChimeId = "chime-1" | "chime-2" | "chime-3";

interface ChimeNote {
  frequency: number;
  startOffset: number;
  duration: number;
}

const CHIMES: Record<ChimeId, ChimeNote[]> = {
  "chime-1": [
    { frequency: 880, startOffset: 0, duration: 0.12 },
    { frequency: 1318.5, startOffset: 0.1, duration: 0.18 },
  ],
  "chime-2": [
    { frequency: 659.25, startOffset: 0, duration: 0.1 },
    { frequency: 783.99, startOffset: 0.08, duration: 0.1 },
    { frequency: 987.77, startOffset: 0.16, duration: 0.2 },
  ],
  "chime-3": [{ frequency: 523.25, startOffset: 0, duration: 0.22 }],
};

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

export function playChime(chime: ChimeId) {
  const ctx = getContext();
  const notes = CHIMES[chime];
  const now = ctx.currentTime;

  for (const note of notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = note.frequency;

    const start = now + note.startOffset;
    const end = start + note.duration;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}

export const CHIME_LABELS: Record<ChimeId, string> = {
  "chime-1": "Ascend",
  "chime-2": "Ripple",
  "chime-3": "Tap",
};
