import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";

const appWindow = getCurrentWindow();

export function TrafficLights() {
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    document.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-tauri-drag-region]") && event.detail === 2) {
        void appWindow.toggleMaximize();
      }
    });
  }, []);

  return (
    <div
      className="flex items-center gap-2"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        aria-label="Close window"
        onClick={() => void appWindow.close()}
        className="traffic-light bg-[#ff5f57]"
      >
        {hovering && <CloseGlyph />}
      </button>
      <button
        aria-label="Minimize window"
        onClick={() => void appWindow.minimize()}
        className="traffic-light bg-[#febc2e]"
      >
        {hovering && <MinimizeGlyph />}
      </button>
      <button
        aria-label="Maximize window"
        onClick={() => void appWindow.toggleMaximize()}
        className="traffic-light bg-[#28c840]"
      >
        {hovering && <MaximizeGlyph />}
      </button>
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
      <path d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5" stroke="#4d0000" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

function MinimizeGlyph() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
      <path d="M0.5 3H5.5" stroke="#985700" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

function MaximizeGlyph() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" fill="none" className={clsx("scale-90")}>
      <path
        d="M1.2 4.8L4.8 1.2M4.8 1.2H2.2M4.8 1.2V3.8"
        stroke="#0a4a00"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
