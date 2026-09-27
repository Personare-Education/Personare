import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";

/*
 * Spec: docs/specs/quiz-ai-import.md -- an imported quiz is created as one
 * unit: the activity, its questions and their options, in file order.
 */

const QUESTIONS = Array.from({ length: 5 }, (_, index) => ({
  options: [
    { isCorrect: false, text: `Q${index + 1} errada A` },
    { isCorrect: true, text: `Q${index + 1} certa` },
    { isCorrect: false, text: `Q${index + 1} errada B` },
  ],
  text: `Pergunta ${index + 1}`,
}));

describe("quiz.createWithQuestions", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let quizClient: RouterClient<typeof quizNamespace>;
  let activitiesClient: RouterClient<typeof activitiesNamespace>;
  let moduleId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-quiz-import-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    quizClient = createRouterClient(quizNamespace);
    activitiesClient = createRouterClient(activitiesNamespace);

    const program = await createRouterClient(programsNamespace).create({
      name: "Programa",
    });
    const createdModule = await createRouterClient(modulesNamespace).create({
      name: "Modulo",
      programId: program.id,
    });
    moduleId = createdModule.id;
  });

  afterEach(() => {
    // Windows refuses to delete an open sqlite file (EPERM).
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("creates a quiz activity with its questions and options, in order", async () => {
    const activity = await quizClient.createWithQuestions({
      moduleId,
      questions: QUESTIONS,
      title: "Quiz importado",
    });

    expect(activity).toMatchObject({
      moduleId,
      title: "Quiz importado",
      type: "quiz",
    });

    const questions = await quizClient.listQuestions({
      activityId: activity.id,
    });
    expect(questions.map((question) => question.text)).toEqual(
      QUESTIONS.map((question) => question.text)
    );

    const options = await quizClient.listOptions({
      questionId: questions[2].id,
    });
    expect(options.map(({ isCorrect, text }) => ({ isCorrect, text }))).toEqual(
      QUESTIONS[2].options
    );
  });

  it("creates nothing when a question is invalid", async () => {
    await expect(
      quizClient.createWithQuestions({
        moduleId,
        questions: [
          ...QUESTIONS,
          { options: [{ isCorrect: true, text: "" }], text: "Quebrada" },
        ],
        title: "Quiz quebrado",
      })
    ).rejects.toThrow();

    expect(await activitiesClient.list({ moduleId })).toEqual([]);
  });

  it("rolls everything back when a write fails midway", async () => {
    // A real database failure on the last option of the last question.
    db.$client.exec(`
      CREATE TRIGGER fail_on_boom BEFORE INSERT ON quiz_options
      WHEN NEW.text = 'BOOM'
      BEGIN SELECT RAISE(ABORT, 'boom'); END;
    `);

    await expect(
      quizClient.createWithQuestions({
        moduleId,
        questions: [
          ...QUESTIONS,
          {
            options: [
              { isCorrect: true, text: "ok" },
              { isCorrect: false, text: "BOOM" },
            ],
            text: "Falha no fim",
          },
        ],
        title: "Quiz interrompido",
      })
    ).rejects.toThrow();

    const count = (table: string) =>
      (
        db.$client.prepare(`select count(*) as total from ${table}`).get() as {
          total: number;
        }
      ).total;
    expect(count("activities")).toBe(0);
    expect(count("quiz_questions")).toBe(0);
    expect(count("quiz_options")).toBe(0);
  });
});
