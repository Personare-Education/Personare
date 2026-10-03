import type { ReactNode } from "react";
import { programTintStyle } from "@/utils/program-tint";
import { cn } from "@/utils/tailwind";

interface SessionEndCardProps {
  children?: ReactNode;
  className?: string;
  /** The program's color, or the brand's for a session across programs. */
  color: string;
  title: string;
}

/**
 * The end of a review session, on a card in the program's color
 * (docs/specs/bolder-cards.md): the same tint as the program cards, the
 * flashcards and the "Today" items, so finishing reads as part of them.
 */
export default function SessionEndCard({
  children,
  className,
  color,
  title,
}: SessionEndCardProps) {
  return (
    <section
      className={cn("flex flex-col gap-3 rounded-xl bg-card p-5", className)}
      data-slot="session-end-card"
      style={programTintStyle(color)}
    >
      <h3 className="text-balance font-medium font-serif text-2xl leading-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}
