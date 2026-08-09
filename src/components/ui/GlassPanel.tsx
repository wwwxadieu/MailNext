import type { HTMLAttributes } from "react";
import clsx from "clsx";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  rounded?: boolean;
}

export function GlassPanel({ elevated, rounded = true, className, children, ...props }: GlassPanelProps) {
  return (
    <div
      className={clsx(
        elevated ? "glass-panel-elevated" : "glass-panel",
        rounded && "rounded-2xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
