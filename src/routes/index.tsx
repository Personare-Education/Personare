import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { format } from "date-fns";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import TodayItemCard from "@/components/today-item-card";
import TodaySessionDialog from "@/components/today-session-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveProgramColor } from "@/constants/program-appearance";
import { useTodayQueue } from "@/hooks/use-today-queue";
import { resolveEventCalendarLocale } from "@/utils/event-calendar-i18n";
import { cn } from "@/utils/tailwind";
import type {
  TodayGroup,
  TodayItem,
  TodayQueue,
  Upcoming,
} from "@/utils/today-queue";

function ProgramGroup({
  group,
  onSelect,
}: {
  group: TodayGroup;
  onSelect: (item: TodayItem) => void;
}) {
  return (
    <section aria-label={group.programName} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-medium text-sm">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full"
          style={{ backgroundColor: resolveProgramColor(group.programColor) }}
        />
        {group.programName}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.items.map((item) => (
          <TodayItemCard
            item={item}
            key={item.activityId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function UpcomingWeek({ upcoming }: { upcoming: Upcoming }) {
  const { i18n, t } = useTranslation();
  const locale = resolveEventCalendarLocale(i18n.language);
  const peak = Math.max(1, ...upcoming.days.map((day) => day.count));

  return (
    <section
      aria-label={t("todayUpcomingTitle")}
      className="flex flex-col gap-3"
    >
      <h2 className="font-medium text-sm">{t("todayUpcomingTitle")}</h2>
      <ol className="grid grid-cols-7 gap-2">
        {upcoming.days.map((day) => (
          <li
            className="flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2"
            key={day.date.toISOString()}
          >
            <span className="text-muted-foreground text-xs capitalize">
              {format(day.date, "EEE", { locale })}
            </span>
            {/* The day's load, as a bar: how the week is spread at a glance. */}
            <span className="flex h-8 w-2 items-end overflow-hidden rounded-full bg-foreground/5">
              <span
                className="w-full rounded-full bg-brand"
                style={{ height: `${(day.count / peak) * 100}%` }}
              />
            </span>
            <span
              className={cn(
                "font-medium text-sm tabular-nums",
                day.count === 0 && "text-muted-foreground"
              )}
            >
              {day.count}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground text-sm">
        {upcoming.nextDate
          ? t("todayNextReview", {
              date: format(upcoming.nextDate, "PPPP", { locale }),
            })
          : t("todayNothingScheduled")}
      </p>
    </section>
  );
}

function DueToday({
  onSelect,
  onStart,
  queue,
}: {
  onSelect: (item: TodayItem) => void;
  onStart: () => void;
  queue: TodayQueue;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-serif text-2xl">
            {t("todayDueSummary", { count: queue.dueCount })}
          </span>
          {/* A deck counts once; its due cards are the detail
              (docs/specs/clarify-daily-count.md AC-1). */}
          {queue.dueCardCount > 0 ? (
            <span className="text-muted-foreground text-sm">
              <span aria-hidden="true">· </span>
              {t("todayDueCardsDetail", { count: queue.dueCardCount })}
            </span>
          ) : null}
          {queue.overdueCount > 0 ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
              {t("todayOverdueSummary", { count: queue.overdueCount })}
            </span>
          ) : null}
        </p>
        <Button onClick={onStart} size="lg">
          {t("todayStartAction")}
        </Button>
      </div>
      <div className="flex flex-col gap-8">
        {queue.groups.map((group) => (
          <ProgramGroup
            group={group}
            key={group.programId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}

const WELCOME_STEPS = [
  "todayWelcomeStep1",
  "todayWelcomeStep2",
  "todayWelcomeStep3",
] as const;

/**
 * The first run, before any program exists (docs/specs/onboard-empty-states.md
 * AC-1): what the app does, the loop in three steps, and the first one.
 */
function Welcome({ replay = false }: { replay?: boolean }) {
  const { t } = useTranslation();

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-balance font-medium font-serif text-2xl leading-tight">
          {t("todayWelcomeTitle")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("todayWelcomeMessage")}
        </p>
      </div>
      <ol
        aria-label={t("todayWelcomeStepsLabel")}
        className="flex flex-col gap-3"
      >
        {WELCOME_STEPS.map((key, index) => (
          <li className="flex items-start gap-3 text-sm" key={key}>
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 font-medium text-brand-text text-xs tabular-nums"
            >
              {index + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{t(key)}</span>
          </li>
        ))}
      </ol>
      {/* Seen again from Settings (docs/specs/replay-welcome.md AC-3): the
          way out is back to Today, not a first program. */}
      {replay ? (
        <Button asChild className="self-start" size="lg">
          <Link search={{}} to="/">
            {t("replayWelcomeBackAction")}
          </Link>
        </Button>
      ) : (
        <Button asChild className="self-start" size="lg">
          <Link search={{ new: true }} to="/programs">
            {t("todayWelcomeAction")}
          </Link>
        </Button>
      )}
    </section>
  );
}

/** Nothing left for today: how the day went and when to come back (AC-8). */
function DayClosed({
  reviewedToday,
  streak,
  upcoming,
}: {
  reviewedToday: number;
  streak: number;
  upcoming: Upcoming;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="font-medium font-serif text-2xl">
          {reviewedToday ? t("todayDayDoneTitle") : t("todayFreeDayTitle")}
        </p>
        {reviewedToday || streak ? (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
            {reviewedToday ? (
              <span>{t("todayReviewedToday", { count: reviewedToday })}</span>
            ) : null}
            {streak ? <span>{t("todayStreak", { count: streak })}</span> : null}
          </p>
        ) : null}
      </div>
      <UpcomingWeek upcoming={upcoming} />
      {upcoming.nextDate ? null : (
        <Button asChild className="self-start" variant="outline">
          <Link to="/programs">{t("todayGoToProgramsAction")}</Link>
        </Button>
      )}
    </div>
  );
}

/**
 * The opening screen (docs/specs/today-review-queue.md): what is due today,
 * a single "Start" for the whole day, and -- with nothing left -- how the
 * day went and when to come back.
 */
export function TodayPage() {
  const { i18n, t } = useTranslation();
  const {
    hasPrograms,
    now,
    queue,
    retry,
    reviewedToday,
    status,
    streak,
    upcoming,
  } = useTodayQueue();
  const [sessionItems, setSessionItems] = useState<TodayItem[] | null>(null);
  const search = useSearch({ strict: false }) as TodaySearch;
  // Asked for again from Settings, with programs already there.
  const isReplayingWelcome = Boolean(search.welcome) && hasPrograms === true;
  const locale = resolveEventCalendarLocale(i18n.language);

  const handleStartClick = useCallback(() => {
    if (queue) {
      setSessionItems(queue.items);
    }
  }, [queue]);

  const handleSelect = useCallback((item: TodayItem) => {
    setSessionItems([item]);
  }, []);

  const handleSessionOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSessionItems(null);
    }
  }, []);

  const hasDue = Boolean(queue && queue.dueCount > 0);

  return (
    <div className="flex h-full flex-col gap-8 p-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-medium font-serif text-3xl tracking-[-0.02em]">
          {t("todayPageTitle")}
        </h1>
        <p className="text-muted-foreground text-sm first-letter:uppercase">
          {format(now, "PPPP", { locale })}
        </p>
      </header>

      {status === "loading" && !queue ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-24 w-full max-w-md" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-sm">{t("todayLoadError")}</p>
          <Button onClick={retry} variant="outline">
            {t("todayRetryAction")}
          </Button>
        </div>
      ) : null}

      {queue && hasPrograms === false ? <Welcome /> : null}

      {queue && isReplayingWelcome ? <Welcome replay /> : null}

      {queue && hasDue && !isReplayingWelcome ? (
        <DueToday
          onSelect={handleSelect}
          onStart={handleStartClick}
          queue={queue}
        />
      ) : null}

      {queue && hasPrograms && !hasDue && !isReplayingWelcome && upcoming ? (
        <DayClosed
          reviewedToday={reviewedToday ?? 0}
          streak={streak ?? 0}
          upcoming={upcoming}
        />
      ) : null}

      <TodaySessionDialog
        items={sessionItems ?? []}
        onOpenChange={handleSessionOpenChange}
        open={sessionItems !== null}
      />
    </div>
  );
}

interface TodaySearch {
  /** Show the welcome again (Settings, docs/specs/replay-welcome.md). */
  welcome?: true;
}

export function validateTodaySearch(
  search: Record<string, unknown>
): TodaySearch {
  return search.welcome === true || search.welcome === "true"
    ? { welcome: true }
    : {};
}

export const Route = createFileRoute("/")({
  component: TodayPage,
  validateSearch: validateTodaySearch,
});
