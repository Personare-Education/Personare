import { addDays, startOfDay } from "date-fns";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import { pointEvents as pointEventsTable } from "@/database/schema";
import {
  loadActivityCounts,
  loadSchedule,
  toLocalDateKey,
} from "@/ipc/shared/schedule";
import {
  clampLoss,
  examPoints,
  overdueLoss,
  quizPoints,
  type ReviewRating,
  reviewPoints,
  streakBreakLoss,
  withStreak,
} from "@/utils/points";
import { rankOf, seasonOf, seasonStartPoints } from "@/utils/ranks";
import { computeCurrentStreak } from "@/utils/streak";

/**
 * Keeping the points ledger (docs/specs/gamification.md §3): gains as they
 * happen, losses when the app settles a new day, and each season's start.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type PointKind =
  | "exam"
  | "overdue"
  | "quiz"
  | "review"
  | "season"
  | "streakBreak";

function activeDays(db: DatabaseClient): Set<string> {
  return new Set(loadActivityCounts(db).map((row) => row.date));
}

function seasonTotal(db: DatabaseClient, season: string): number {
  const row = db
    .select({
      total: sql<number>`coalesce(sum(${pointEventsTable.amount}), 0)`,
    })
    .from(pointEventsTable)
    .where(eq(pointEventsTable.season, season))
    .get();
  return Number(row?.total ?? 0);
}

function exists(
  db: DatabaseClient,
  kind: PointKind,
  sourceId: string,
  dayKey?: string
): boolean {
  return (
    db
      .select({ id: pointEventsTable.id })
      .from(pointEventsTable)
      .where(
        and(
          eq(pointEventsTable.kind, kind),
          eq(pointEventsTable.sourceId, sourceId),
          dayKey ? eq(pointEventsTable.dayKey, dayKey) : undefined
        )
      )
      .get() !== undefined
  );
}

function insert(
  db: DatabaseClient,
  now: Date,
  kind: PointKind,
  amount: number,
  sourceId: string | null
): void {
  db.insert(pointEventsTable)
    .values({
      amount,
      createdAt: now,
      dayKey: toLocalDateKey(now),
      kind,
      season: seasonOf(now).id,
      sourceId,
    })
    .run();
}

/**
 * A new season starts from where the last one ended, 6 steps down
 * (§4): written once, before the season's first gain or loss.
 */
function ensureSeason(db: DatabaseClient, now: Date): void {
  const season = seasonOf(now).id;
  const started = db
    .select({ id: pointEventsTable.id })
    .from(pointEventsTable)
    .where(eq(pointEventsTable.season, season))
    .get();
  if (started) {
    return;
  }
  const last = db
    .select({ season: pointEventsTable.season })
    .from(pointEventsTable)
    .where(lt(pointEventsTable.season, season))
    .orderBy(desc(pointEventsTable.season))
    .get();
  const carried = last ? seasonStartPoints(seasonTotal(db, last.season)) : 0;
  if (carried > 0) {
    insert(db, now, "season", carried, season);
  }
}

/** A gain, with the streak's bonus as it stands now. */
function gain(
  db: DatabaseClient,
  now: Date,
  kind: PointKind,
  points: number,
  sourceId: string
): void {
  ensureSeason(db, now);
  const streak = computeCurrentStreak(activeDays(db), now);
  insert(db, now, kind, withStreak(points, streak), sourceId);
}

/**
 * A rated review (§3): its rating's points, 5 more when done on the day it
 * was due or before. Called once the rating is saved, so today counts in
 * the streak.
 */
export function recordReviewPoints(
  db: DatabaseClient,
  {
    dueDate,
    itemId,
    now,
    rating,
  }: { dueDate: Date | null; itemId: string; now: Date; rating: ReviewRating }
): void {
  const onTime = dueDate === null || dueDate >= startOfDay(now);
  gain(db, now, "review", reviewPoints(rating, onTime), itemId);
}

/** A quiz's right answers, once a day per quiz (§3). */
export function recordQuizPoints(
  db: DatabaseClient,
  {
    activityId,
    correct,
    now,
  }: { activityId: string; correct: number; now: Date }
): void {
  if (exists(db, "quiz", activityId, toLocalDateKey(now))) {
    return;
  }
  gain(db, now, "quiz", quizPoints(correct), activityId);
}

/** An exam's day's first attempt (§3): its right answers, 30 for passing. */
export function recordExamPoints(
  db: DatabaseClient,
  {
    correct,
    examId,
    now,
    passed,
  }: { correct: number; examId: string; now: Date; passed: boolean }
): void {
  if (exists(db, "exam", examId, toLocalDateKey(now))) {
    return;
  }
  gain(db, now, "exam", examPoints(correct, passed), examId);
}

/**
 * What the days since the last look cost (§3), each once however often it
 * runs: reviews newly more than a day overdue (locked ones never count),
 * and a broken streak of 3 days or more.
 */
export function settlePoints(db: DatabaseClient, now: Date): void {
  ensureSeason(db, now);
  const season = seasonOf(now).id;
  const today = toLocalDateKey(now);

  const overdue = loadSchedule(db)
    .filter((row) => row.dueDate.getTime() < now.getTime() - DAY_MS)
    .map((row) => `${row.id}@${toLocalDateKey(row.dueDate)}`)
    .filter((episode) => !exists(db, "overdue", episode));
  let takenToday = -Number(
    db
      .select({
        total: sql<number>`coalesce(sum(${pointEventsTable.amount}), 0)`,
      })
      .from(pointEventsTable)
      .where(
        and(
          eq(pointEventsTable.kind, "overdue"),
          eq(pointEventsTable.dayKey, today)
        )
      )
      .get()?.total ?? 0
  );
  for (const episode of overdue) {
    const loss = clampLoss(overdueLoss(1, takenToday), seasonTotal(db, season));
    // Written even when nothing is taken, so it is never counted again.
    insert(db, now, "overdue", loss, episode);
    takenToday -= loss;
  }

  // The last day with a review before today; a full day missed since breaks
  // the streak that ended there.
  const active = activeDays(db);
  const yesterday = toLocalDateKey(addDays(now, -1));
  const lastActive = [...active]
    .filter((day) => day < today)
    .sort()
    .at(-1);
  if (lastActive && lastActive < yesterday) {
    const source = `streak@${lastActive}`;
    if (!exists(db, "streakBreak", source)) {
      const [year, month, day] = lastActive.split("-").map(Number);
      const streak = computeCurrentStreak(
        active,
        new Date(year, month - 1, day, 12)
      );
      insert(
        db,
        now,
        "streakBreak",
        clampLoss(streakBreakLoss(streak), seasonTotal(db, season)),
        source
      );
    }
  }
}

const RECENT_EVENTS = 20;

/** The season's points and step, what is left to the next, and the history. */
export function pointsSummary(db: DatabaseClient, now: Date) {
  const season = seasonOf(now);
  const points = Math.max(0, seasonTotal(db, season.id));
  const rank = rankOf(points);
  const recent = db
    .select({
      amount: pointEventsTable.amount,
      createdAt: pointEventsTable.createdAt,
      kind: pointEventsTable.kind,
    })
    .from(pointEventsTable)
    .where(
      and(
        eq(pointEventsTable.season, season.id),
        sql`${pointEventsTable.amount} != 0`
      )
    )
    .orderBy(desc(pointEventsTable.createdAt))
    .limit(RECENT_EVENTS)
    .all();
  const pastSeasons = db
    .select({
      points: sql<number>`sum(${pointEventsTable.amount})`,
      season: pointEventsTable.season,
    })
    .from(pointEventsTable)
    .where(lt(pointEventsTable.season, season.id))
    .groupBy(pointEventsTable.season)
    .orderBy(desc(pointEventsTable.season))
    .all()
    .map((row) => {
      const total = Math.max(0, Number(row.points));
      return { points: total, season: row.season, step: rankOf(total).step };
    });

  return {
    pastSeasons,
    points,
    rank,
    recent,
    season,
    toNext: rank.end === null ? null : rank.end - points,
  };
}
