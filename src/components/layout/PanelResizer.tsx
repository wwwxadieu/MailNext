import { useCallback, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import clsx from "clsx";

interface PanelResizerProps {
  onResize: (newWidth: number) => void;
  currentWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

export function PanelResizer({
  onResize,
  currentWidth,
  minWidth = 260,
  maxWidth = 650,
}: PanelResizerProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const startX = e.clientX;
      const startWidth = currentWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [currentWidth, minWidth, maxWidth, onResize],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={clsx(
        "group relative z-30 flex h-full w-2 flex-shrink-0 cursor-col-resize items-center justify-center transition-colors select-none",
        isDragging ? "bg-accent/40" : "hover:bg-accent/20 active:bg-accent/40",
      )}
      title="Kéo vách ngăn để điều chỉnh độ rộng"
    >
      {/* Separator Line */}
      <div
        className={clsx(
          "h-full w-[1px] transition-colors",
          isDragging
            ? "bg-accent w-[2px]"
            : "bg-black/10 dark:bg-white/10 group-hover:bg-accent/60",
        )}
      />

      {/* Drag Handle Indicator */}
      <div
        className={clsx(
          "absolute h-8 w-1 rounded-full transition-all duration-150",
          isDragging
            ? "bg-accent scale-110 shadow-md opacity-100"
            : "bg-neutral-300 dark:bg-neutral-600 opacity-0 group-hover:opacity-100",
        )}
      />
    </div>
  );
}
