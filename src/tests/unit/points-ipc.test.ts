import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { reviewItems as reviewItemsTable } from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { exams as examsNamespace } from "@/ipc/exams";
import { modules as modulesNamespace } from "@/ipc/modules";
import { points as pointsNamespace } from "@/ipc/points";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";
import { review as reviewNamespace } from "@/ipc/review";
import { collectBackupData, restoreBackupData } from "@/utils/backup-data";
import { withStreak } from "@/utils/points";
import { rankOf, seasonStartPoints } from "@/utils/ranks";

/**
 * RED phase (docs/specs/gamification.md §3): points earned and lost, kept
 * in a ledger, by season.
 */

function createClients() {
  return {
    activities: createRouterClient(activitiesNamespace),
    exams: createRouterClient(examsNamespace),
    modules: createRouterClient(modulesNamespace),
    points: createRouterClient(pointsNamespace),
    programs: createRouterClient(programsNamespace),
    quiz: createRouterClient(quizNamespace),
    review: createRouterClient(reviewNamespace),
  };
}

const QUESTIONS = [
  {
    options: [
      { isCorrect: true, text: "Sim" },
      { isCorrect: false, text: "Não" },
    ],
    text: "Pergunta",
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

describe("points (gamification.md §3)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let clients: ReturnType<typeof createClients>;
  let moduleId: string;
  let programId: string;

  /** Midday, so the local day never shifts. */
  const at = (date: string) => vi.setSystemTime(new Date(`${date}T12:00:00`));

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at("2026-10-05");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-points-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    clients = createClients();
    programId = (await clients.programs.create({ name: "P" })).id;
    moduleId = (await clients.modules.create({ name: "M", programId })).id;
  });

  afterEach(() => {
    vi.useRealTimers();
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  const link = (title: string) =>
    clients.activities.create({
      moduleId,
      title,
      type: "link",
      url: "https://a.com",
    });
  const rate = (
    activityId: string,
    rating: "again" | "easy" | "good" | "hard"
  ) => clients.review.markActivityDifficulty({ activityId, rating });
  const points = async () => (await clients.points.summary()).points;

  describe("earning (AC-2)", () => {
    it("gives a review its points, on time, with the streak bonus", async () => {
      const { id } = await link("L");

      await rate(id, "good");

      // A first review is on time; the streak is 1 day after it.
      expect(await points()).toBe(withStreak(15, 1));
    });

    it("gives no on-time bonus to a review done after its day", async () => {
      const { id } = await link("L");
      await rate(id, "good");
      const before = await points();
      db.update(reviewItemsTable)
        .set({ dueDate: new Date(Date.now() - 3 * DAY_MS) })
        .where(eq(reviewItemsTable.activityId, id))
        .run();

      await rate(id, "hard");

      expect((await points()) - before).toBe(withStreak(8, 1));
    });

    it("gives a quiz's right answers once a day", async () => {
      const { id } = await clients.quiz.createWithQuestions({
        moduleId,
        questions: QUESTIONS,
        title: "Q",
      });

      await clients.points.awardQuiz({ activityId: id, correct: 4 });
      await clients.points.awardQuiz({ activityId: id, correct: 4 });
      // No review yet today: no streak bonus.
      expect(await points()).toBe(12);

      at("2026-10-06");
      await clients.points.awardQuiz({ activityId: id, correct: 1 });
      expect(await points()).toBe(15);
    });

    it("gives an exam its points on the day's first attempt, with 30 for passing", async () => {
      await clients.quiz.createWithQuestions({
        moduleId,
        questions: QUESTIONS,
        title: "Q",
      });
      const exam = await clients.exams.create({
        moduleIds: [moduleId],
        passingScore: 70,
        programId,
        questionCount: 1,
        timeLimitMinutes: null,
        title: "P1",
      });
      const attempt = (correct: number) =>
        clients.exams.saveAttempt({
          correct,
          durationMs: 1000,
          examId: exam.id,
          startedAt: new Date(),
          total: 4,
        });

      await attempt(3);
      await attempt(4);

      expect(await points()).toBe(3 * 3 + 30);
    });
  });

  describe("losing (AC-2)", () => {
    it("takes 2 for each review more than a day overdue, once", async () => {
      const first = await link("A");
      const second = await link("B");
      await rate(first.id, "good");
      await rate(second.id, "good");
      const earned = await points();
      db.update(reviewItemsTable)
        .set({ dueDate: new Date(Date.now() - 2 * DAY_MS) })
        .run();

      await clients.points.settle();
      await clients.points.settle();

      expect(await points()).toBe(earned - 4);
    });

    it("takes 20 when a streak of 3 days breaks, once", async () => {
      const { id } = await link("L");
      for (const day of ["2026-10-01", "2026-10-02", "2026-10-03"]) {
        at(day);
        db.update(reviewItemsTable)
          .set({ dueDate: new Date(Date.now() + 10 * DAY_MS) })
          .run();
        // biome-ignore lint/performance/noAwaitInLoops: each day's review must land before the clock moves on.
        await rate(id, "good");
      }
      const earned = await points();

      // The 4th went by without a review.
      at("2026-10-05");
      await clients.points.settle();
      await clients.points.settle();

      expect(await points()).toBe(earned - 20);
    });

    it("never goes below 0", async () => {
      const { id } = await link("L");
      await rate(id, "again");
      const items = await Promise.all(
        [1, 2, 3, 4, 5, 6].map((index) => link(`X${index}`))
      );
      await Promise.all(items.map((item) => rate(item.id, "again")));
      db.update(reviewItemsTable)
        .set({ dueDate: new Date(Date.now() - 5 * DAY_MS) })
        .run();
      db.$client.exec("DELETE FROM point_events WHERE amount > 0");

      await clients.points.settle();

      expect(await points()).toBe(0);
    });
  });

  describe("seasons (§4)", () => {
    it("starts a new season 6 steps below where the last ended, keeping the last in the history", async () => {
      at("2026-09-20");
      const { id } = await link("L");
      db.$client
        .prepare(
          "INSERT INTO point_events (id, created_at, day_key, kind, amount, season) VALUES ('seed', ?, '2026-09-20', 'review', 1500, '2026-Q3')"
        )
        .run(Date.now());

      at("2026-10-02");
      await clients.points.settle();
      const summary = await clients.points.summary();

      expect(summary.season.id).toBe("2026-Q4");
      expect(summary.points).toBe(seasonStartPoints(1500));
      expect(summary.pastSeasons).toEqual([
        { points: 1500, season: "2026-Q3", step: rankOf(1500).step },
      ]);
      expect(id).toBeTruthy();
    });
  });

  it("says the step, the next one and what is left (AC-3)", async () => {
    const { id } = await link("L");
    await rate(id, "good");

    const summary = await clients.points.summary();

    expect(summary.rank).toMatchObject({ division: 3, step: 1, tier: "iron" });
    expect(summary.toNext).toBe(100 - summary.points);
    expect(summary.recent[0]).toMatchObject({ kind: "review" });
  });

  it("carries the ledger in the backup; an older one restores with no points (AC-4)", async () => {
    const { id } = await link("L");
    await rate(id, "good");
    const data = collectBackupData(db);
    expect(data.pointEvents).toHaveLength(1);

    restoreBackupData(db, data);
    expect(await points()).toBeGreaterThan(0);

    const { pointEvents: _events, ...older } = data;
    restoreBackupData(db, older);
    expect(await points()).toBe(0);
  });
});
