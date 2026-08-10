import type { ReactNode } from "react";
import { TrafficLights } from "@/components/layout/TrafficLights";

interface TitleBarProps {
  children?: ReactNode;
  /** Right-aligned action buttons (e.g. the calendar panel toggle) — kept
   * separate from `children` so the compose window's centered title text
   * doesn't have to share space with main-window-only controls. */
  right?: ReactNode;
}

export function TitleBar({ children, right }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="glass-panel flex h-11 flex-shrink-0 items-center gap-4 rounded-t-2xl border-x-0 border-t-0 px-4"
    >
      <TrafficLights />
      <div data-tauri-drag-region className="flex flex-1 items-center justify-center gap-3">
        {children}
      </div>
      {right && <div className="flex flex-shrink-0 items-center gap-1">{right}</div>}
    </div>
  );
}
