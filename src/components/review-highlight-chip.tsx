import { useTranslation } from "react-i18next";
import type { ReviewHighlight } from "@/utils/review-highlight";
import { cn } from "@/utils/tailwind";

const HIGHLIGHT_LABEL_KEYS: Record<ReviewHighlight, string> = {
  focus: "reviewFocusLabel",
  overdue: "reviewOverdueLabel",
  today: "reviewDueTodayLabel",
};

/**
 * "Review due today" / "Review overdue", visible (docs/specs/today-review-queue.md
 * AC-11). The table puts it where the date would go, not among the actions
 * (docs/specs/layout-tables.md AC-3).
 */
export default function ReviewHighlightChip({
  highlight,
}: {
  highlight: ReviewHighlight;
}) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-[0.6875rem]",
        highlight === "overdue"
          ? "bg-destructive/10 text-destructive-text"
          : "bg-brand/10 text-brand-text"
      )}
    >
      {t(HIGHLIGHT_LABEL_KEYS[highlight])}
    </span>
  );
}
