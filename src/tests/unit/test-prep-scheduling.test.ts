import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { addDays, format, startOfDay } from "date-fns";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { reviewLogs } from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { review as reviewNamespace } from "@/ipc/review";

/** docs/specs/test-prep-scheduling.md AC-1 to AC-3. */

let tmpDir: string;
let db: DatabaseClient;
const programs = createRouterClient(programsNamespace);
const modules = createRouterClient(modulesNamespace);
const activities = createRouterClient(activitiesNamespace);
const review = createRouterClient(reviewNamespace);

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-test-prep-"));
  db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
  runMigrations(db);
  setDatabaseClient(db);
});

afterEach(() => {
  db.$client.close();
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

/** A PDF in a program; "easy" on a first rating lands weeks away. */
async function pdfIn(goal: {
  studyGoal: "retain" | "test_prep";
  targetDate?: string;
}) {
  const program = await programs.create({ name: "Residência", ...goal });
  const module = await modules.create({
    name: "Cardio",
    programId: program.id,
  });
  return activities.create({
    moduleId: module.id,
    title: "Diretriz",
    type: "pdf",
  });
}

const inDays = (days: number) =>
  format(addDays(new Date(), days), "yyyy-MM-dd");
const eveOf = (days: number) => startOfDay(addDays(new Date(), days - 1));

describe("studying for a test (D7)", () => {
  it("schedules nothing after the test's eve", async () => {
    const pdf = await pdfIn({ studyGoal: "test_prep", targetDate: inDays(5) });

    const rated = await review.markActivityDifficulty({
      activityId: pdf.id,
      rating: "easy",
    });

    expect(rated.dueDate).toEqual(eveOf(5));
    expect(db.select().from(reviewLogs).get()?.dueAfter).toEqual(eveOf(5));
  });

  it("shows the same limit on the rating buttons", async () => {
    const pdf = await pdfIn({ studyGoal: "test_prep", targetDate: inDays(5) });

    const preview = await review.previewRatings({ activityId: pdf.id });

    expect(preview.easy).toEqual(eveOf(5));
    expect(preview.good.getTime()).toBeLessThanOrEqual(eveOf(5).getTime());
  });

  it("leaves 'Nunca mais esquecer' as FSRS schedules it", async () => {
    const pdf = await pdfIn({ studyGoal: "retain" });

    const rated = await review.markActivityDifficulty({
      activityId: pdf.id,
      rating: "easy",
    });

    expect(rated.dueDate.getTime()).toBeGreaterThan(eveOf(5).getTime());
  });

  it("acts as 'Nunca mais esquecer' after the test", async () => {
    const pdf = await pdfIn({ studyGoal: "test_prep", targetDate: inDays(-1) });

    const rated = await review.markActivityDifficulty({
      activityId: pdf.id,
      rating: "easy",
    });

    expect(rated.dueDate.getTime()).toBeGreaterThan(
      addDays(new Date(), 5).getTime()
    );
  });
});
