import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "h-9 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none transition-shadow focus:border-neutral-400/70 focus:ring-2 focus:ring-neutral-400/25 dark:focus:border-white/30 dark:focus:ring-white/15",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

TextField.displayName = "TextField";
