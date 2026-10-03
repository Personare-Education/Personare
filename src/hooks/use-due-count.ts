import { useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ensureReviewItems, listSchedule } from "@/actions/calendar";
import { onReviewCompleted } from "@/utils/review-events";
import { msUntilNextLocalMidnight } from "@/utils/streak";
import { buildTodayQueue, countDueByProgram } from "@/utils/today-queue";

interface DueReviews {
  /** Each program's due reviews, for its card. */
  byProgram: Map<string, number>;
  /** Every due review: the count the Today screen leads with. */
  total: number;
}

const NONE: DueReviews = { byProgram: new Map(), total: 0 };

/**
 * How many reviews are due today, overall and per program
 * (docs/specs/today-review-queue.md AC-1, AC-10), with the Today screen's
 * own definition of "due". It follows reviews as they are done and the day
 * as it turns over.
 */
export function useDueReviews(): DueReviews {
  const [due, setDue] = useState<DueReviews>(NONE);
  const [day, setDay] = useState(() => new Date());
  // Content created elsewhere (new flashcards are due at once) shows up on
  // the next navigation, not only after a review.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const load = useCallback(() => {
    ensureReviewItems()
      .then(() => listSchedule())
      .then((rows) => {
        const now = new Date();
        setDue({
          byProgram: countDueByProgram(rows, now),
          total: buildTodayQueue(rows, now).dueCount,
        });
      })
      .catch(() => undefined);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload on navigation (see above).
  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => onReviewCompleted(load), [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDay(new Date());
      load();
    }, msUntilNextLocalMidnight(day) + 1000);
    return () => clearTimeout(timer);
  }, [day, load]);

  return due;
}

/** The sidebar's Today count. */
export function useDueCount(): number {
  return useDueReviews().total;
}
