import { AlarmClock } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { ReviewHighlight } from "@/utils/review-highlight";
import { cn } from "@/utils/tailwind";

interface ReviewHighlightTableFrameProps {
  /** The table, whose rows carry `data-row-id` (ActionableTableRow's `rowId`). */
  children: ReactNode;
  highlightById: Record<string, ReviewHighlight | undefined>;
}

/**
 * The bordered box around a data table, plus a gutter on its left with a
 * ringing alarm clock beside each overdue row
 * (docs/specs/calendar-module-review-highlight.md AC-5). The clocks live
 * outside the table -- the shadcn table's own scroll wrapper would clip
 * anything drawn past a row -- so each one is placed at its row's measured
 * height, and re-placed whenever the table resizes (rows wrapping, loading).
 */
export default function ReviewHighlightTableFrame({
  children,
  highlightById,
}: ReviewHighlightTableFrameProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const overdueIds = Object.keys(highlightById).filter(
    (id) => highlightById[id] === "overdue"
  );
  const overdueKey = overdueIds.join(",");
  const [topById, setTopById] = useState<Record<string, number>>({});

  const measure = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const frameTop = frame.getBoundingClientRect().top;
    const next: Record<string, number> = {};
    for (const id of overdueKey.split(",").filter(Boolean)) {
      const row = frame.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
      if (row) {
        const box = row.getBoundingClientRect();
        next[id] = box.top - frameTop + box.height / 2;
      }
    }
    setTopById(next);
  }, [overdueKey]);

  useLayoutEffect(() => {
    measure();

    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      className={cn("relative", overdueIds.length > 0 && "pl-8")}
      ref={frameRef}
    >
      {overdueIds.map((id) => (
        <span
          className="absolute left-0 flex size-6 -translate-y-1/2 items-center justify-center text-destructive"
          data-slot="overdue-review-marker"
          key={id}
          style={{ top: topById[id] ?? 0 }}
          title={t("reviewOverdueLabel")}
        >
          <AlarmClock aria-hidden="true" className="review-alarm size-5" />
        </span>
      ))}
      <div className="overflow-hidden rounded-lg border">{children}</div>
    </div>
  );
}
