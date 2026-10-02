import { addDays, startOfDay } from "date-fns";
import type { CalendarEvent } from "@/components/reui/event-calendar";
import { ipc } from "@/ipc/manager";
import { toLocalDayKey } from "@/utils/review-highlight";

export interface ScheduleRow {
  activityFilePath: string | null;
  activityId: string;
  activityTitle: string;
  activityType: string;
  activityUrl: string | null;
  dueDate: Date;
  /** Only set for a Flashcard-scoped row -- null for an Activity-scoped one (Issue #77). */
  front: string | null;
  id: string;
  moduleId: string;
  moduleName: string;
  /** Null for a program created before colors existed. */
  programColor: string | null;
  programId: string;
  programName: string;
}

export interface CalendarEventData {
  /** The event's local day, `yyyy-MM-dd`. */
  date: string;
  moduleId: string;
  programId: string;
}

export function ensureReviewItems() {
  return ipc.client.review.ensureReviewItems({});
}

export function listSchedule() {
  return ipc.client.review.listSchedule();
}

/**
 * One event per module per local day (docs/specs/calendar-module-review-highlight.md
 * AC-1), titled with the module's name: a module with several reviews that
 * day (different activities, or flashcards of one deck) shows up once.
 */
export function toCalendarEvents(
  rows: ScheduleRow[]
): CalendarEvent<CalendarEventData>[] {
  const eventsById = new Map<string, CalendarEvent<CalendarEventData>>();

  for (const row of rows) {
    // allDay bounds must already be display-zone midnights, or the
    // calendar's own day-segmentation walks past the day it's stored on and
    // paints the bar into the next day too (event-calendar-lib.tsx's
    // segmentOccurrence contract) -- dueDate carries whatever time-of-day
    // the review happened at, so it has to be floored to the local day
    // first.
    const day = startOfDay(row.dueDate);
    const date = toLocalDayKey(day);
    const id = `${row.moduleId}:${date}`;

    if (!eventsById.has(id)) {
      eventsById.set(id, {
        allDay: true,
        data: { date, moduleId: row.moduleId, programId: row.programId },
        end: addDays(day, 1),
        id,
        readOnly: true,
        start: day,
        title: row.moduleName,
      });
    }
  }

  return [...eventsById.values()];
}
