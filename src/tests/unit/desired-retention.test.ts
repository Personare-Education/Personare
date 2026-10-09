import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { Rating } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { reviewItems } from "@/database/schema";
import { setDatabaseClient } from "@/ipc/database/state";
import { review as reviewNamespace } from "@/ipc/review";
import { settings as settingsNamespace } from "@/ipc/settings";
import {
  applyRating,
  DEFAULT_DESIRED_RETENTION,
  previewRatings,
  type ReviewItemRow,
} from "@/utils/fsrs";

/** docs/specs/desired-retention.md. */

vi.mock("electron", () => ({
  app: { setLoginItemSettings: vi.fn() },
}));

const NOW = new Date("2026-03-01T00:00:00Z");

const REVIEWED: ReviewItemRow = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  difficulty: 5,
  dueDate: NOW,
  id: "r1",
  lapses: 0,
  lastRating: "good",
  lastReviewedAt: new Date("2026-02-20T00:00:00Z"),
  learningSteps: 0,
  ratingHistory: "[]",
  reps: 3,
  scheduledDays: 9,
  stability: 10,
  state: "Review",
  updatedAt: new Date("2026-02-20T00:00:00Z"),
};

function daysUntil(date: Date) {
  return (date.getTime() - NOW.getTime()) / 86_400_000;
}

describe("FSRS with a desired retention (AC-2)", () => {
  it("defaults to 90%, ts-fsrs's own default", () => {
    expect(DEFAULT_DESIRED_RETENTION).toBe(0.9);
    const implicit = applyRating(REVIEWED, Rating.Good, NOW);
    const explicit = applyRating(REVIEWED, Rating.Good, NOW, {
      desiredRetention: 0.9,
    });
    expect(implicit.card.due).toEqual(explicit.card.due);
  });

  it("brings the next review sooner the higher the retention", () => {
    const due = (desiredRetention: number) =>
      daysUntil(
        applyRating(REVIEWED, Rating.Good, NOW, { desiredRetention }).card.due
      );

    expect(due(0.95)).toBeLessThan(due(0.9));
    expect(due(0.9)).toBeLessThan(due(0.85));
    expect(due(0.85)).toBeLessThan(due(0.8));
  });

  it("applies to an Activity's whole-day scheduler too", () => {
    const due = (desiredRetention: number) =>
      daysUntil(
        applyRating(REVIEWED, Rating.Good, NOW, {
          desiredRetention,
          shortTermEnabled: false,
        }).card.due
      );

    expect(due(0.95)).toBeLessThan(due(0.8));
  });

  it("previews with the same retention it rates with", () => {
    const preview = previewRatings(REVIEWED, NOW, { desiredRetention: 0.8 });
    const rated = applyRating(REVIEWED, Rating.Good, NOW, {
      desiredRetention: 0.8,
    });

    expect(preview.good).toEqual(rated.card.due);
  });
});

describe("settings.desiredRetention (AC-1)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  const client = createRouterClient(settingsNamespace);

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-retention-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("is 90% until the student picks another", async () => {
    expect((await client.get()).desiredRetention).toBe(0.9);
  });

  it("saves the one picked", async () => {
    await client.setDesiredRetention({ desiredRetention: 0.95 });

    expect((await client.get()).desiredRetention).toBe(0.95);
  });

  it.each([0.5, 0.99, 1])("refuses %s", async (desiredRetention) => {
    await expect(
      client.setDesiredRetention({ desiredRetention })
    ).rejects.toThrow();
  });
});

describe("rating with the saved retention (AC-3)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  const settings = createRouterClient(settingsNamespace);
  const review = createRouterClient(reviewNamespace);

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-retention-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function insertReviewed(id: string) {
    const now = new Date();
    db.insert(reviewItems)
      .values({
        ...REVIEWED,
        createdAt: now,
        dueDate: now,
        id,
        lastReviewedAt: new Date(now.getTime() - 9 * 86_400_000),
        updatedAt: now,
      })
      .run();
  }

  async function goodDueWith(desiredRetention: number, id: string) {
    await settings.setDesiredRetention({ desiredRetention });
    insertReviewed(id);
    const preview = await review.previewRatings({ reviewItemId: id });
    const rated = await review.submitRating({
      rating: "good",
      reviewItemId: id,
    });
    // A few milliseconds apart: each call reads the clock.
    expect(
      Math.abs(rated.dueDate.getTime() - preview.good.getTime())
    ).toBeLessThan(60_000);
    return rated.dueDate.getTime();
  }

  it("schedules sooner at 95% than at 80%, and previews what it rates", async () => {
    const strict = await goodDueWith(0.95, "a");
    const relaxed = await goodDueWith(0.8, "b");

    expect(strict).toBeLessThan(relaxed);
  });
});
