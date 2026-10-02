import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureReviewItems,
  listSchedule,
  type ScheduleRow,
} from "@/actions/calendar";
import { listPrograms } from "@/actions/programs";
import { listActivityCounts } from "@/actions/streak";
import { onReviewCompleted } from "@/utils/review-events";
import {
  computeCurrentStreak,
  msUntilNextLocalMidnight,
  toActiveDateSet,
} from "@/utils/streak";
import {
  buildTodayQueue,
  buildUpcoming,
  countReviewedOn,
} from "@/utils/today-queue";

type Status = "error" | "loading" | "ready";

interface TodayData {
  counts: { count: number; date: string }[];
  programOrder: string[];
  rows: ScheduleRow[];
}

/**
 * Everything the "Today" screen shows (docs/specs/today-review-queue.md):
 * the day's queue, the next days, what was done today and the streak. It
 * reloads after every review and at local midnight (AC-9).
 */
export function useTodayQueue() {
  const [data, setData] = useState<TodayData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(
    () =>
      ensureReviewItems()
        .then(() =>
          Promise.all([listSchedule(), listActivityCounts(), listPrograms()])
        )
        .then(([rows, counts, programs]) => {
          setData({
            counts,
            programOrder: programs.map((program) => program.id),
            rows,
          });
          setNow(new Date());
          setStatus("ready");
        })
        .catch(() => {
          setStatus((prev) => (prev === "ready" ? prev : "error"));
        }),
    []
  );

  const retry = useCallback(() => {
    setStatus("loading");
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onReviewCompleted(load), [load]);

  // The day turns over with the app open: what was "tomorrow" is due now.
  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(new Date());
      load();
    }, msUntilNextLocalMidnight(now) + 1000);
    return () => clearTimeout(timer);
  }, [load, now]);

  const derived = useMemo(() => {
    if (!data) {
      return null;
    }
    return {
      queue: buildTodayQueue(data.rows, now, data.programOrder),
      reviewedToday: countReviewedOn(data.counts, now),
      streak: computeCurrentStreak(toActiveDateSet(data.counts), now),
      upcoming: buildUpcoming(data.rows, now),
    };
  }, [data, now]);

  return { ...derived, now, retry, status };
}
