import {
  FileText,
  Layers,
  Link as LinkIcon,
  ListChecks,
  ListOrdered,
  type LucideIcon,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { resolveProgramColor } from "@/constants/program-appearance";
import { programTintStyle } from "@/utils/program-tint";
import { cn } from "@/utils/tailwind";
import type { TodayItem } from "@/utils/today-queue";

const TYPE_ICONS: Record<string, LucideIcon> = {
  flashcard_deck: Layers,
  group: ListOrdered,
  link: LinkIcon,
  pdf: FileText,
  quiz: ListChecks,
};

const TYPE_LABEL_KEYS: Record<string, string> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  group: "activityTypeGroup",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

interface TodayItemCardProps {
  /** A one-line version, above a deck's flipping card in the session. */
  compact?: boolean;
  item: TodayItem;
  /** Makes the card a button (the list on the Today screen). */
  onSelect?: (item: TodayItem) => void;
}

/**
 * One thing due today, in its program's color
 * (docs/specs/today-review-queue.md AC-3): its type, title, module, how
 * urgent it is and, for a deck, how many cards are due.
 */
export default function TodayItemCard({
  compact = false,
  item,
  onSelect,
}: TodayItemCardProps) {
  const { t } = useTranslation();
  const Icon = TYPE_ICONS[item.activityType] ?? FileText;
  const typeLabel = t(
    TYPE_LABEL_KEYS[item.activityType] ?? "activityTypeLabel"
  );

  const handleClick = useCallback(() => {
    onSelect?.(item);
  }, [item, onSelect]);

  const content = (
    <>
      {/* Foreground, not gray, on the program's tint (docs/specs/audit-a11y.md AC-2). */}
      <span className="flex items-center gap-1.5 text-foreground/70 text-xs">
        <Icon aria-hidden="true" className="size-3.5" />
        {typeLabel}
        {item.cardCount > 0 ? (
          <span className="tabular-nums">
            · {t("todayCardCount", { count: item.cardCount })}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "font-medium font-serif leading-snug",
          compact ? "text-base" : "text-lg"
        )}
      >
        {item.activityTitle}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground/70 text-xs">
        <span>{item.moduleName}</span>
        {/* Everything here is for today; only being late is news
            (docs/specs/today-layout.md AC-3). */}
        {item.urgency === "overdue" ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive-text">
            {t("todayUrgencyOverdue", { count: item.overdueDays })}
          </span>
        ) : null}
      </span>
    </>
  );

  const className = cn(
    "flex w-full flex-col items-start gap-1.5 rounded-xl bg-card text-left",
    compact ? "p-3" : "p-4"
  );
  const style = programTintStyle(resolveProgramColor(item.programColor));

  if (onSelect) {
    return (
      <button
        className={cn(
          className,
          "cursor-pointer outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        )}
        onClick={handleClick}
        style={style}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
