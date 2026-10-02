import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type CalendarEventData,
  ensureReviewItems,
  listSchedule,
  type ScheduleRow,
  toCalendarEvents,
} from "@/actions/calendar";
import {
  getCalendarConnectionStatus,
  syncCalendar,
} from "@/actions/calendar-sync";
import {
  type CalendarEvent,
  EventCalendar,
  EventCalendarContent,
  EventCalendarNav,
} from "@/components/reui/event-calendar";
import { Button } from "@/components/ui/button";
import {
  buildEventCalendarI18n,
  resolveEventCalendarLocale,
} from "@/utils/event-calendar-i18n";

const SYNC_ERROR_MESSAGE_KEYS: Record<string, string> = {
  calendar_not_connected: "calendarNotConnectedErrorMessage",
  calendar_reconnect_required: "calendarReconnectRequiredErrorMessage",
};

export function CalendarPage() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent<CalendarEventData>[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const eventCalendarI18n = useMemo(() => buildEventCalendarI18n(t), [t]);
  const eventCalendarLocale = useMemo(
    () => resolveEventCalendarLocale(i18n.language),
    [i18n.language]
  );

  useEffect(() => {
    ensureReviewItems()
      .then(() => listSchedule())
      .then((rows) => {
        setScheduleRows(rows);
        setEvents(toCalendarEvents(rows));
      });
    getCalendarConnectionStatus().then(setIsCalendarConnected);
  }, []);

  // Every view (month, agenda) reports clicks here: open the event's
  // program with its module and day in focus
  // (docs/specs/calendar-module-review-highlight.md AC-2).
  const handleEventClick = useCallback(
    ({ event }: { event: CalendarEvent<CalendarEventData> }) => {
      if (!event.data) {
        return;
      }
      navigate({
        params: { programId: event.data.programId },
        search: {
          focusDate: event.data.date,
          focusModuleId: event.data.moduleId,
        },
        to: "/programs/$programId",
      });
    },
    [navigate]
  );

  const handleSyncClick = useCallback(() => {
    setIsSyncing(true);
    setSyncMessage(null);

    syncCalendar(
      scheduleRows.map((row) => ({
        // Local calendar day, not UTC: row.dueDate carries whatever
        // time-of-day the review happened at, and toISOString() converts to
        // UTC first, which crosses into the next (or previous) day
        // depending on the user's timezone offset and the time of day. The
        // backend treats this as an all-day event, so it must already be a
        // plain local date, matching how the in-app calendar itself floors
        // to the local day (src/actions/calendar.ts, toCalendarEvents).
        dueDate: format(row.dueDate, "yyyy-MM-dd"),
        front: row.front ?? row.activityTitle,
        id: row.id,
      }))
    )
      .then((result) => {
        if ("error" in result) {
          const messageKey = SYNC_ERROR_MESSAGE_KEYS[result.error];
          setSyncMessage(
            messageKey ? t(messageKey) : t("calendarSyncErrorMessage")
          );
          return;
        }

        setSyncMessage(
          t("calendarSyncResultMessage", {
            created: result.created,
            deleted: result.deleted,
            updated: result.updated,
          })
        );
      })
      .catch(() => {
        setSyncMessage(t("calendarSyncErrorMessage"));
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, [scheduleRows, t]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          disabled={!isCalendarConnected || isSyncing}
          onClick={handleSyncClick}
          variant="outline"
        >
          {t("syncCalendarAction")}
        </Button>
        {syncMessage ? (
          <p className="text-muted-foreground text-sm">{syncMessage}</p>
        ) : null}
        {/* Says why the button is off (docs/specs/rating-clarity.md AC-4). */}
        {isCalendarConnected || syncMessage ? null : (
          <p className="text-muted-foreground text-sm">
            {t("calendarSyncDisabledHint")}
          </p>
        )}
      </div>
      <EventCalendar
        className="h-full"
        defaultView="month"
        events={events}
        i18n={eventCalendarI18n}
        interactions={{ drag: false, resize: false, selectSlot: false }}
        locale={eventCalendarLocale}
        onEventClick={handleEventClick}
        onEventsChange={setEvents}
        views={["month", "agenda"]}
      >
        <EventCalendarNav />
        <EventCalendarContent />
      </EventCalendar>
    </div>
  );
}

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});
