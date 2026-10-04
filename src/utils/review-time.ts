import { differenceInCalendarDays, formatDistanceStrict } from "date-fns";
import type { TFunction } from "i18next";
import i18n from "i18next";
import { resolveEventCalendarLocale } from "@/utils/event-calendar-i18n";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;

/**
 * The interval is computed a moment before it is shown, so it lands just
 * under a whole unit (59.9 seconds, 23.99 hours): pick the natural unit with
 * a little slack, then round, so it reads "1 minute" and "1 day".
 */
function naturalUnit(ms: number): "minute" | "hour" | "day" | undefined {
  if (ms < HOUR_MS - MINUTE_MS) {
    return "minute";
  }
  if (ms < DAY_MS - HOUR_MS) {
    return "hour";
  }
  if (ms < MONTH_MS) {
    return "day";
  }
  return undefined;
}

/**
 * How long until `due`, in the app's language ("4 days", "10 minutes") --
 * the interval a rating button shows (docs/specs/rating-clarity.md AC-1).
 */
export function formatInterval(due: Date, now: Date): string {
  const ms = Math.max(MINUTE_MS, due.getTime() - now.getTime());
  return formatDistanceStrict(now.getTime() + ms, now, {
    locale: resolveEventCalendarLocale(i18n.language),
    roundingMethod: "round",
    unit: naturalUnit(ms),
  });
}

/**
 * A review's due day relative to today ("Today", "Tomorrow", "In 4 days",
 * "Overdue by 2 days"), for the activities table (AC-3).
 */
export function formatRelativeDue(due: Date, now: Date, t: TFunction): string {
  const days = differenceInCalendarDays(due, now);
  if (days < 0) {
    return t("todayUrgencyOverdue", { count: -days });
  }
  if (days === 0) {
    return t("reviewDueToday");
  }
  if (days === 1) {
    return t("reviewDueTomorrow");
  }
  return t("reviewDueInDays", { count: days });
}

/**
 * How far ahead a card may come back within the same review session: the
 * FSRS short learning steps (1 and 10 minutes) fit, a day does not
 * (docs/specs/relearn-in-session.md AC-1).
 */
const SESSION_RETURN_WINDOW_MS = 20 * 60 * 1000;

/** Whether a card rated just now comes back before the session ends. */
export function returnsThisSession(due: Date, now: Date): boolean {
  return due.getTime() - now.getTime() <= SESSION_RETURN_WINDOW_MS;
}
