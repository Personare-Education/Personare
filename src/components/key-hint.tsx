import type { ReactNode } from "react";
import { cn } from "@/utils/tailwind";

/**
 * A key a shortcut uses, shown beside the action (docs/specs/key-hints.md).
 * Visual only: the button keeps its name, and aria-keyshortcuts announces
 * the shortcut.
 */
export default function KeyHint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded-sm border border-current/25 px-1 font-normal font-sans text-[0.625rem] leading-4 opacity-70",
        className
      )}
      data-slot="key-hint"
    >
      {children}
    </span>
  );
}
