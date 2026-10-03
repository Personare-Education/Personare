import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import type { ScheduleRow } from "@/actions/calendar";
import { toLocalDayKey } from "@/utils/review-highlight";

/**
 * The "Today" screen's data (docs/specs/today-review-queue.md): what is due
 * until the end of today, grouped by program, and a preview of the next
 * days. Pure, so the screen and its tests share one definition of "due".
 */

export type TodayRow = ScheduleRow;

export type TodayUrgency = "overdue" | "today";

export interface TodayItem {
  activityFilePath: string | null;
  activityId: string;
  activityTitle: string;
  activityType: string;
  activityUrl: string | null;
  /** Due flashcards of a deck (each one a review of its own); 0 otherwise. */
  cardCount: number;
  moduleId: string;
  moduleName: string;
  /** Whole days since it was due; 0 when it is due today. */
  overdueDays: number;
  programColor: string | null;
  programId: string;
  programName: string;
  urgency: TodayUrgency;
}

export interface TodayGroup {
  items: TodayItem[];
  programColor: string | null;
  programId: string;
  programName: string;
}

export interface TodayQueue {
  /** Due flashcards across every deck: the detail after the activities. */
  dueCardCount: number;
  /**
   * Activities due, a deck counting once: the one unit every screen uses
   * (docs/specs/clarify-daily-count.md).
   */
  dueCount: number;
  groups: TodayGroup[];
  /** Every item, in display order: program by program, overdue first. */
  items: TodayItem[];
  /** Activities with at least one overdue review. */
  overdueCount: number;
}

const DECK_TYPE = "flashcard_deck";

function compareItems(a: TodayItem, b: TodayItem): number {
  if (a.overdueDays !== b.overdueDays) {
    return b.overdueDays - a.overdueDays;
  }
  return a.activityTitle.localeCompare(b.activityTitle);
}

export function buildTodayQueue(
  rows: TodayRow[],
  now: Date,
  programOrder: string[] = []
): TodayQueue {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const itemsByActivity = new Map<string, TodayItem>();

  for (const row of rows) {
    if (row.dueDate >= tomorrow) {
      continue;
    }
    const overdueDays = Math.max(
      0,
      differenceInCalendarDays(today, startOfDay(row.dueDate))
    );

    const existing = itemsByActivity.get(row.activityId);
    if (existing) {
      existing.cardCount += row.activityType === DECK_TYPE ? 1 : 0;
      if (overdueDays > existing.overdueDays) {
        existing.overdueDays = overdueDays;
        existing.urgency = "overdue";
      }
      continue;
    }
    itemsByActivity.set(row.activityId, {
      activityFilePath: row.activityFilePath,
      activityId: row.activityId,
      activityTitle: row.activityTitle,
      activityType: row.activityType,
      activityUrl: row.activityUrl,
      cardCount: row.activityType === DECK_TYPE ? 1 : 0,
      moduleId: row.moduleId,
      moduleName: row.moduleName,
      overdueDays,
      programColor: row.programColor,
      programId: row.programId,
      programName: row.programName,
      urgency: overdueDays > 0 ? "overdue" : "today",
    });
  }

  const groupsById = new Map<string, TodayGroup>();
  for (const item of itemsByActivity.values()) {
    const group = groupsById.get(item.programId) ?? {
      items: [],
      programColor: item.programColor,
      programId: item.programId,
      programName: item.programName,
    };
    group.items.push(item);
    groupsById.set(item.programId, group);
  }

  const rank = (programId: string) => {
    const index = programOrder.indexOf(programId);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  const groups = [...groupsById.values()].sort(
    (a, b) =>
      rank(a.programId) - rank(b.programId) ||
      a.programName.localeCompare(b.programName)
  );
  for (const group of groups) {
    group.items.sort(compareItems);
  }

  const items = groups.flatMap((group) => group.items);

  return {
    dueCardCount: items.reduce((sum, item) => sum + item.cardCount, 0),
    dueCount: items.length,
    groups,
    items,
    overdueCount: items.filter((item) => item.urgency === "overdue").length,
  };
}

export interface UpcomingDay {
  count: number;
  /** The local day, at midnight. */
  date: Date;
}

export interface Upcoming {
  /** The next 7 days, starting tomorrow. */
  days: UpcomingDay[];
  /** The first day after today with a review, however far; null if none. */
  nextDate: Date | null;
}

const UPCOMING_DAYS = 7;

export function buildUpcoming(rows: TodayRow[], now: Date): Upcoming {
  const tomorrow = addDays(startOfDay(now), 1);
  const days: UpcomingDay[] = Array.from({ length: UPCOMING_DAYS }, (_, i) => ({
    count: 0,
    date: addDays(tomorrow, i),
  }));
  let nextDate: Date | null = null;
  // Each day counts an activity once, a deck's cards included
  // (docs/specs/clarify-daily-count.md AC-6).
  const seen = days.map(() => new Set<string>());

  for (const row of rows) {
    if (row.dueDate < tomorrow) {
      continue;
    }
    const day = startOfDay(row.dueDate);
    const index = differenceInCalendarDays(day, tomorrow);
    if (index < UPCOMING_DAYS && !seen[index].has(row.activityId)) {
      seen[index].add(row.activityId);
      days[index].count += 1;
    }
    if (!nextDate || day < nextDate) {
      nextDate = day;
    }
  }

  return { days, nextDate };
}

/**
 * Each program's activities due until the end of today (its card's badge,
 * AC-10), a deck counting once (docs/specs/clarify-daily-count.md AC-2).
 */
export function countDueByProgram(
  rows: TodayRow[],
  now: Date
): Map<string, number> {
  const tomorrow = addDays(startOfDay(now), 1);
  const activities = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.dueDate < tomorrow) {
      const set = activities.get(row.programId) ?? new Set<string>();
      set.add(row.activityId);
      activities.set(row.programId, set);
    }
  }
  return new Map(
    Array.from(activities, ([programId, set]) => [programId, set.size])
  );
}

/**
 * Activities reviewed on `day`'s local date, summed across programs, each
 * activity once (docs/specs/clarify-daily-count.md AC-4).
 */
export function countReviewedOn(
  counts: { activities: number; date: string }[],
  day: Date
): number {
  const key = toLocalDayKey(day);
  return counts.reduce(
    (sum, entry) => (entry.date === key ? sum + entry.activities : sum),
    0
  );
}
