import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function toActiveDateSet(rows: { date: string }[]): Set<string> {
  return new Set(rows.map((row) => row.date));
}

/**
 * Consecutive days (ending today) with at least one review. A day that
 * hasn't happened yet doesn't break the streak the instant it starts --
 * if today has no activity yet but yesterday did, the streak is still
 * "alive" until today actually ends (local midnight), so counting starts
 * from yesterday in that case instead of resetting to 0 immediately.
 */
export function computeCurrentStreak(
  activeDates: Set<string>,
  today: Date
): number {
  let cursor = today;

  if (!activeDates.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (activeDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/** Longest run of consecutive calendar days anywhere in the history. */
export function computeBestStreak(activeDates: Set<string>): number {
  if (activeDates.size === 0) {
    return 0;
  }

  const sortedDates = [...activeDates].sort();
  let best = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i += 1) {
    const previous = new Date(sortedDates[i - 1]);
    const currentDate = new Date(sortedDates[i]);
    const dayGap = Math.round(
      (currentDate.getTime() - previous.getTime()) / DAY_MS
    );

    current = dayGap === 1 ? current + 1 : 1;
    best = Math.max(best, current);
  }

  return best;
}

/**
 * The streak a review just lit, or null (docs/specs/gamification.md §1
 * AC-4): today was not counted before it and is now.
 */
export function streakIgnition(
  before: Set<string>,
  after: Set<string>,
  now: Date
): number | null {
  const today = toDateKey(now);
  return !before.has(today) && after.has(today)
    ? computeCurrentStreak(after, now)
    : null;
}

export function msUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = startOfDay(addDays(now, 1));
  return nextMidnight.getTime() - now.getTime();
}

export interface StreakCalendarDay {
  date: Date;
  dateKey: string;
  isActive: boolean;
  isOutsideMonth: boolean;
  isToday: boolean;
}

/** Weeks (Sun-Sat) covering `month`, including the leading/trailing days of neighboring months needed to fill the grid. */
export function buildMonthGrid(
  month: Date,
  activeDates: Set<string>,
  today: Date
): StreakCalendarDay[][] {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const todayKey = toDateKey(today);
  const monthIndex = month.getMonth();

  const weeks: StreakCalendarDay[][] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    const week: StreakCalendarDay[] = [];

    for (let i = 0; i < DAYS_PER_WEEK; i += 1) {
      const dateKey = toDateKey(cursor);
      week.push({
        date: cursor,
        dateKey,
        isActive: activeDates.has(dateKey),
        isOutsideMonth: cursor.getMonth() !== monthIndex,
        isToday: dateKey === todayKey,
      });
      cursor = addDays(cursor, 1);
    }

    weeks.push(week);
  }

  return weeks;
}
