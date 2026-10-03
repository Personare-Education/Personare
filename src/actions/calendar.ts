import { addDays, startOfDay } from "date-fns";
import type { CalendarEvent } from "@/components/reui/event-calendar";
import { resolveProgramColor } from "@/constants/program-appearance";
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
 * AC-1), in its program's color (docs/specs/calendar-system.md AC-3): a
 * module with several reviews that day (different activities, or
 * flashcards of one deck) shows up once. `formatTitle` names it from the
 * module and how many activities come back; without it, the module's name.
 */
export function toCalendarEvents(
  rows: ScheduleRow[],
  formatTitle: (moduleName: string, activityCount: number) => string = (
    moduleName
  ) => moduleName
): CalendarEvent<CalendarEventData>[] {
  const eventsById = new Map<string, CalendarEvent<CalendarEventData>>();
  const activitiesById = new Map<string, Set<string>>();

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

    const activities = activitiesById.get(id) ?? new Set<string>();
    activities.add(row.activityId);
    activitiesById.set(id, activities);

    if (!eventsById.has(id)) {
      eventsById.set(id, {
        allDay: true,
        color: resolveProgramColor(row.programColor),
        data: { date, moduleId: row.moduleId, programId: row.programId },
        end: addDays(day, 1),
        id,
        readOnly: true,
        start: day,
        title: row.moduleName,
      });
    }
  }

  for (const [id, event] of eventsById) {
    const moduleName = event.title ?? "";
    event.title = formatTitle(moduleName, activitiesById.get(id)?.size ?? 0);
  }

  return [...eventsById.values()];
}
