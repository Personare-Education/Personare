import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/tailwind";

interface EmptyStateProps {
  /** The way to fill it, usually the button that creates the first item. */
  action?: ReactNode;
  className?: string;
  icon: LucideIcon;
  message: string;
  title: string;
}

/**
 * An empty list that says what goes in it and how to start
 * (docs/specs/onboard-empty-states.md). No border or card around it: it is
 * the page's content, not a box on the page.
 */
export default function EmptyState({
  action,
  className,
  icon: Icon,
  message,
  title,
}: EmptyStateProps) {
  return (
    <section
      className={cn("flex max-w-lg flex-col items-start gap-3 py-6", className)}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="font-medium font-serif text-2xl leading-tight">{title}</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </section>
  );
}
