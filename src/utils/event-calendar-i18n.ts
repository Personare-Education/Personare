import type { Locale } from "date-fns";
import { ar, de, enUS, es, fr, ja, ko, ptBR, zhCN } from "date-fns/locale";
import type { TFunction } from "i18next";
import type { EventCalendarI18nOverrides } from "@/components/reui/event-calendar/event-calendar-i18n";

/**
 * date-fns Locale for the EventCalendar's own date formatting (month/weekday
 * names, "MMMM yyyy" title, etc.) -- separate from the `i18n` prop below,
 * which only covers the library's own UI strings (button labels, aria
 * labels), not date formatting.
 */
const EVENT_CALENDAR_LOCALES: Record<string, Locale> = {
  ar,
  de,
  en: enUS,
  es,
  fr,
  ja,
  ko,
  "pt-BR": ptBR,
  "zh-CN": zhCN,
};

export function resolveEventCalendarLocale(language: string): Locale {
  return EVENT_CALENDAR_LOCALES[language] ?? enUS;
}

/**
 * Translates every EventCalendar label/viewName except two: `viewShortcuts`
 * (single decorative letters in the view switcher, not tied to a real
 * keyboard shortcut, and mostly identical between en/pt-BR anyway --
 * Month/Mês, Day/Dia, Agenda/Agenda) and `eventDetails`, which just echoes
 * the event's own (already-localized) title back, nothing to translate.
 */
export function buildEventCalendarI18n(
  t: TFunction
): EventCalendarI18nOverrides {
  return {
    labels: {
      addEvent: t("calendarAddEventAction"),
      allDay: t("calendarAllDayLabel"),
      continues: t("calendarContinuesLabel"),
      dropNotAllowed: t("calendarDropNotAllowedLabel"),
      event: t("calendarEventLabel"),
      events: (count) =>
        count === 1
          ? t("calendarOneEventLabel")
          : t("calendarEventsCountLabel", { count }),
      goToDate: t("calendarGoToDateLabel"),
      loading: t("calendarLoadingMessage"),
      more: (count) => t("calendarMoreEventsLabel", { count }),
      moreCompact: (count) => t("calendarMoreCompactLabel", { count }),
      next: t("calendarNextAction"),
      noEvents: t("calendarNoEventsMessage"),
      previous: t("calendarPreviousAction"),
      resources: t("calendarResourcesLabel"),
      selectView: t("calendarSelectViewLabel"),
      timeFrom: (time) => t("calendarTimeFromLabel", { time }),
      timeRange: (from, to) => t("calendarTimeRangeLabel", { from, to }),
      timeUntil: (time) => t("calendarTimeUntilLabel", { time }),
      today: t("calendarTodayAction"),
      toggleDayEvents: (count) =>
        count === 1
          ? t("calendarOneEventLabel")
          : t("calendarEventsCountLabel", { count }),
      week: (weekNumber) =>
        t("calendarWeekNumberLabel", { number: weekNumber }),
    },
    viewNames: {
      agenda: t("calendarViewAgendaLabel"),
      day: t("calendarViewDayLabel"),
      days: (count) =>
        count === 1
          ? t("calendarOneDayLabel")
          : t("calendarDaysCountLabel", { count }),
      month: t("calendarViewMonthLabel"),
      resource: t("calendarViewResourceLabel"),
      week: t("calendarViewWeekLabel"),
    },
  };
}
