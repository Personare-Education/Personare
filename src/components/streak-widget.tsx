import { addMonths, format, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Flame, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listActivityCounts } from "@/actions/streak";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { resolveEventCalendarLocale } from "@/utils/event-calendar-i18n";
import { onReviewCompleted } from "@/utils/review-events";
import {
  buildMonthGrid,
  computeBestStreak,
  computeCurrentStreak,
  msUntilNextLocalMidnight,
  toActiveDateSet,
} from "@/utils/streak";
import { cn } from "@/utils/tailwind";

const WEEKDAY_COUNT = 7;
const TICK_MS = 1000;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / TICK_MS));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function StreakWidget() {
  const { i18n, t } = useTranslation();
  const locale = resolveEventCalendarLocale(i18n.language);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const [displayMonth, setDisplayMonth] = useState(() => new Date());

  const refreshActiveDates = useCallback(() => {
    listActivityCounts().then((rows) => setActiveDates(toActiveDateSet(rows)));
  }, []);

  useEffect(() => {
    refreshActiveDates();
  }, [refreshActiveDates]);

  /**
   * A rating can be persisted from deep inside a route (Activities page,
   * the app-root pending-rating dialog) while this widget, mounted once in
   * the sidebar, never remounts on navigation to pick up fresh data on its
   * own -- see src/utils/review-events.ts for why this is a pub/sub instead
   * of prop-drilled state.
   */
  useEffect(() => onReviewCompleted(refreshActiveDates), [refreshActiveDates]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const currentStreak = useMemo(
    () => computeCurrentStreak(activeDates, now),
    [activeDates, now]
  );
  const bestStreak = useMemo(
    () => computeBestStreak(activeDates),
    [activeDates]
  );
  const monthGrid = useMemo(
    () => buildMonthGrid(displayMonth, activeDates, now),
    [displayMonth, activeDates, now]
  );
  const weekdayLabels = useMemo(() => {
    const week = monthGrid[0] ?? [];
    return week.map((day) => format(day.date, "EEEEE", { locale }));
  }, [monthGrid, locale]);

  const handlePreviousMonth = useCallback(() => {
    setDisplayMonth((month) => subMonths(month, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setDisplayMonth((month) => addMonths(month, 1));
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              aria-label={t("streakDaysLabel", { count: currentStreak })}
            >
              <Flame className={cn(currentStreak > 0 && "text-orange-500")} />
              <span>{t("streakDaysLabel", { count: currentStreak })}</span>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">
                {t("streakDayOfMonthLabel", { day: now.getDate() })}
              </span>
              <span className="font-mono text-muted-foreground text-xs">
                {formatCountdown(msUntilNextLocalMidnight(now))}
              </span>
            </div>
            <p className="text-[0.65rem] text-muted-foreground">
              {t("streakResetsAtMidnightMessage")}
            </p>

            <div className="flex items-center justify-between">
              <Button
                aria-label={t("calendarPreviousAction")}
                onClick={handlePreviousMonth}
                size="icon-sm"
                variant="ghost"
              >
                <ChevronLeft />
              </Button>
              <span className="font-medium text-sm">
                {format(displayMonth, "MMMM yyyy", { locale })}
              </span>
              <Button
                aria-label={t("calendarNextAction")}
                onClick={handleNextMonth}
                size="icon-sm"
                variant="ghost"
              >
                <ChevronRight />
              </Button>
            </div>

            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${WEEKDAY_COUNT}, minmax(0, 1fr))`,
              }}
            >
              {weekdayLabels.map((label, index) => (
                <span
                  className="text-center text-[0.65rem] text-muted-foreground uppercase"
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-column weekday header, never reordered.
                  key={index}
                >
                  {label}
                </span>
              ))}
              {monthGrid.flat().map((day) => (
                <span
                  className={cn(
                    "flex size-7 items-center justify-center justify-self-center rounded-full text-xs",
                    day.isOutsideMonth && "text-muted-foreground/40",
                    day.isActive &&
                      !day.isOutsideMonth &&
                      "bg-orange-500/15 font-medium text-orange-600 dark:text-orange-400",
                    day.isToday && "ring-2 ring-orange-500"
                  )}
                  key={day.dateKey}
                >
                  {day.date.getDate()}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
                <span className="text-[0.65rem] text-muted-foreground">
                  {t("streakCurrentLabel")}
                </span>
                <span className="flex items-center gap-1 font-medium text-sm">
                  <Flame className="size-4 text-orange-500" />
                  {t("streakDaysLabel", { count: currentStreak })}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
                <span className="text-[0.65rem] text-muted-foreground">
                  {t("streakBestLabel")}
                </span>
                <span className="flex items-center gap-1 font-medium text-sm">
                  <Trophy className="size-4 text-amber-500" />
                  {t("streakDaysLabel", { count: bestStreak })}
                </span>
              </div>
            </div>

            <p className="text-[0.65rem] text-muted-foreground">
              {t("streakHintMessage")}
            </p>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
