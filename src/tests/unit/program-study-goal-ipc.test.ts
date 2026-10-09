import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { programs as programsTable } from "@/database/schema";
import { setDatabaseClient } from "@/ipc/database/state";
import { programs as programsNamespace } from "@/ipc/programs";

/** docs/specs/program-study-goal.md AC-1 to AC-3. */

let tmpDir: string;
let db: DatabaseClient;
const client = createRouterClient(programsNamespace);

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-study-goal-"));
  db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
  runMigrations(db);
  setDatabaseClient(db);
});

afterEach(() => {
  db.$client.close();
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

describe("a program's study goal", () => {
  it("is 'Nunca mais esquecer' when none is given, without a date", async () => {
    const program = await client.create({ name: "Cálculo I" });

    expect(program.studyGoal).toBe("retain");
    expect(program.targetDate).toBeNull();
  });

  it("is 'Estudar para uma Prova' with the test's day", async () => {
    const program = await client.create({
      name: "Residência",
      studyGoal: "test_prep",
      targetDate: "2026-11-20",
    });

    expect(program.studyGoal).toBe("test_prep");
    expect(program.targetDate).toBe("2026-11-20");
    expect((await client.list())[0]).toMatchObject({
      studyGoal: "test_prep",
      targetDate: "2026-11-20",
    });
  });

  it("needs a valid day to study for a test", async () => {
    await expect(
      client.create({ name: "Residência", studyGoal: "test_prep" })
    ).rejects.toThrow();
    await expect(
      client.create({
        name: "Residência",
        studyGoal: "test_prep",
        targetDate: "2026-02-31",
      })
    ).rejects.toThrow();
  });

  it("drops the date when the goal is 'Nunca mais esquecer'", async () => {
    const program = await client.create({
      name: "Cálculo I",
      studyGoal: "retain",
      targetDate: "2026-11-20",
    });

    expect(program.targetDate).toBeNull();
  });

  it("can be changed when editing, keeping the history", async () => {
    const program = await client.create({ name: "Cálculo I" });

    const updated = await client.update({
      id: program.id,
      name: "Cálculo I",
      studyGoal: "test_prep",
      targetDate: "2026-12-01",
    });

    expect(updated).toMatchObject({
      id: program.id,
      studyGoal: "test_prep",
      targetDate: "2026-12-01",
    });
  });

  it("is kept when an edit doesn't mention it", async () => {
    const program = await client.create({
      name: "Residência",
      studyGoal: "test_prep",
      targetDate: "2026-11-20",
    });

    const updated = await client.update({
      id: program.id,
      name: "Residência R1",
    });

    expect(updated).toMatchObject({
      studyGoal: "test_prep",
      targetDate: "2026-11-20",
    });
  });

  it("is 'Nunca mais esquecer' for programs created before it existed", () => {
    const now = new Date();
    db.insert(programsTable)
      .values({ createdAt: now, name: "Antigo", updatedAt: now })
      .run();

    expect(db.select().from(programsTable).get()).toMatchObject({
      studyGoal: "retain",
      targetDate: null,
    });
  });

  it("is set from the program's page, without touching the rest", async () => {
    const program = await client.create({ color: "#fff", name: "Cálculo I" });

    const asTest = await client.setStudyGoal({
      id: program.id,
      studyGoal: "test_prep",
      targetDate: "2026-12-01",
    });
    expect(asTest).toMatchObject({
      color: "#fff",
      name: "Cálculo I",
      studyGoal: "test_prep",
      targetDate: "2026-12-01",
    });

    const back = await client.setStudyGoal({
      id: program.id,
      studyGoal: "retain",
      targetDate: "2026-12-01",
    });
    expect(back).toMatchObject({ studyGoal: "retain", targetDate: null });

    await expect(
      client.setStudyGoal({ id: program.id, studyGoal: "test_prep" })
    ).rejects.toThrow();
  });
});
