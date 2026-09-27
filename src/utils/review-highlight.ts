import { addDays, format, startOfDay } from "date-fns";

/**
 * How urgent a pending review is: due some time today, or overdue (due
 * before today and still not done). Doing the review moves its due date
 * into the future, which is what clears it.
 */
export type ReviewUrgency = "overdue" | "today";

/**
 * What a table row shows: a pending review's urgency, or "focus" for a row
 * picked from the calendar whose review is on a later day.
 */
export type ReviewHighlight = ReviewUrgency | "focus";

interface ReviewUrgencyRow {
  activityId: string;
  dueDate: Date;
  moduleId: string;
}

export function getReviewUrgency(
  dueDate: Date,
  now: Date
): ReviewUrgency | null {
  const today = startOfDay(now);

  if (dueDate < today) {
    return "overdue";
  }
  if (dueDate < addDays(today, 1)) {
    return "today";
  }
  return null;
}

function mostUrgent(
  current: ReviewUrgency | undefined,
  next: ReviewUrgency
): ReviewUrgency {
  return current === "overdue" ? current : next;
}

/** Rolls review urgency up per activity and per module, overdue winning. */
export function summarizeReviewUrgency(
  rows: ReviewUrgencyRow[],
  now: Date
): {
  byActivityId: Record<string, ReviewUrgency>;
  byModuleId: Record<string, ReviewUrgency>;
} {
  const byActivityId: Record<string, ReviewUrgency> = {};
  const byModuleId: Record<string, ReviewUrgency> = {};

  for (const row of rows) {
    const urgency = getReviewUrgency(row.dueDate, now);
    if (urgency) {
      byActivityId[row.activityId] = mostUrgent(
        byActivityId[row.activityId],
        urgency
      );
      byModuleId[row.moduleId] = mostUrgent(byModuleId[row.moduleId], urgency);
    }
  }

  return { byActivityId, byModuleId };
}

/** A local calendar day as `yyyy-MM-dd`, the format of `focusDate`. */
export function toLocalDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** The module's activities with a review on the given local day. */
export function getFocusedActivityIds(
  rows: ReviewUrgencyRow[],
  moduleId: string,
  focusDate: string | undefined
): Set<string> {
  if (!focusDate) {
    return new Set();
  }

  return new Set(
    rows
      .filter(
        (row) =>
          row.moduleId === moduleId && toLocalDayKey(row.dueDate) === focusDate
      )
      .map((row) => row.activityId)
  );
}

/**
 * A row's highlight: overdue wins (red and the clock), then due today, then
 * the calendar's focus.
 */
export function toReviewHighlight(
  urgency: ReviewUrgency | undefined,
  isFocused: boolean
): ReviewHighlight | undefined {
  if (urgency) {
    return urgency;
  }
  return isFocused ? "focus" : undefined;
}
