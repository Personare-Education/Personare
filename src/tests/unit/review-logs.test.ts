import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { asc } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { reviewLogs } from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { flashcards as flashcardsNamespace } from "@/ipc/flashcards";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { review as reviewNamespace } from "@/ipc/review";
import { collectBackupData, restoreBackupData } from "@/utils/backup-data";

/** docs/specs/review-logs.md. */

let tmpDir: string;
let db: DatabaseClient;
const programs = createRouterClient(programsNamespace);
const modules = createRouterClient(modulesNamespace);
const activities = createRouterClient(activitiesNamespace);
const flashcards = createRouterClient(flashcardsNamespace);
const review = createRouterClient(reviewNamespace);

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-review-logs-"));
  db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
  runMigrations(db);
  setDatabaseClient(db);
});

afterEach(() => {
  db.$client.close();
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

async function setUpModule(studyGoal: "retain" | "test_prep") {
  const program = await programs.create({
    name: "Residência",
    studyGoal,
    targetDate: studyGoal === "test_prep" ? "2030-01-01" : null,
  });
  return modules.create({ name: "Cardiologia", programId: program.id });
}

function logs() {
  return db.select().from(reviewLogs).orderBy(asc(reviewLogs.reviewedAt)).all();
}

describe("review_logs", () => {
  it("records a flashcard's ratings as recall, with what the model predicted", async () => {
    const module = await setUpModule("test_prep");
    const deck = await activities.create({
      moduleId: module.id,
      title: "Arritmias",
      type: "flashcard_deck",
    });
    await flashcards.create({ activityId: deck.id, back: "B", front: "F" });
    await review.ensureReviewItems({ activityId: deck.id });
    const [item] = await review.listDue({ activityId: deck.id });

    await review.submitRating({
      durationMs: 4200,
      rating: "good",
      reviewItemId: item.id,
    });
    await review.submitRating({ rating: "again", reviewItemId: item.id });

    const [first, second] = logs();
    expect(first).toMatchObject({
      durationMs: 4200,
      elapsedDays: null,
      itemKind: "recall",
      rating: "good",
      retrievabilityBefore: null,
      reviewItemId: item.id,
      stateBefore: "New",
      studyGoal: "test_prep",
    });
    expect(first.desiredRetention).toBe(0.9);
    expect(first.dueAfter.getTime()).toBeGreaterThan(
      first.reviewedAt.getTime()
    );
    expect(second).toMatchObject({ durationMs: null, rating: "again" });
    expect(second.stateBefore).toBe(first.stateAfter);
    expect(second.stabilityBefore).toBe(first.stabilityAfter);
    expect(second.elapsedDays).toBeGreaterThanOrEqual(0);
    expect(second.retrievabilityBefore).toBeGreaterThan(0);
    expect(second.retrievabilityBefore).toBeLessThanOrEqual(1);
  });

  it("records a whole activity's rating as coverage", async () => {
    const module = await setUpModule("retain");
    const pdf = await activities.create({
      moduleId: module.id,
      title: "Diretriz",
      type: "pdf",
    });

    await review.markActivityDifficulty({ activityId: pdf.id, rating: "hard" });

    expect(logs()).toEqual([
      expect.objectContaining({
        itemKind: "coverage",
        rating: "hard",
        studyGoal: "retain",
      }),
    ]);
  });

  it("refuses a negative duration", async () => {
    await expect(
      review.submitRating({
        durationMs: -1,
        rating: "good",
        reviewItemId: "x",
      })
    ).rejects.toThrow();
  });

  it("goes with the backup and comes back on restore", async () => {
    const module = await setUpModule("retain");
    const pdf = await activities.create({
      moduleId: module.id,
      title: "Diretriz",
      type: "pdf",
    });
    await review.markActivityDifficulty({ activityId: pdf.id, rating: "good" });
    const data = collectBackupData(db);
    expect(data.reviewLogs).toHaveLength(1);

    restoreBackupData(db, data);
    expect(logs()).toHaveLength(1);

    restoreBackupData(db, { ...data, reviewLogs: undefined });
    expect(logs()).toHaveLength(0);
  });
});
