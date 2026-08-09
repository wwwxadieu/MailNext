import type { ReactNode } from "react";
import { TrafficLights } from "@/components/layout/TrafficLights";

interface TitleBarProps {
  children?: ReactNode;
}

export function TitleBar({ children }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="glass-panel flex h-11 flex-shrink-0 items-center gap-4 rounded-t-2xl border-x-0 border-t-0 px-4"
    >
      <TrafficLights />
      <div data-tauri-drag-region className="flex flex-1 items-center justify-center gap-3">
        {children}
      </div>
    </div>
  );
}
