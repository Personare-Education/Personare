import {
  FileText,
  Layers,
  Link as LinkIcon,
  ListChecks,
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
  link: LinkIcon,
  pdf: FileText,
  quiz: ListChecks,
};

const TYPE_LABEL_KEYS: Record<string, string> = {
  flashcard_deck: "activityTypeFlashcardDeck",
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

  const urgency =
    item.urgency === "overdue"
      ? t("todayUrgencyOverdue", { count: item.overdueDays })
      : t("todayUrgencyToday");

  const content = (
    <>
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
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
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
        <span>{item.moduleName}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium",
            item.urgency === "overdue"
              ? "bg-destructive/10 text-destructive"
              : "bg-foreground/5 text-foreground"
          )}
        >
          {urgency}
        </span>
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
          "cursor-pointer outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
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
