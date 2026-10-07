import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { exams as examsNamespace } from "@/ipc/exams";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";
import { review as reviewNamespace } from "@/ipc/review";

/**
 * RED phase (docs/specs/exams.md §4): a module that unlocks once an exam
 * of its program is passed.
 */

function createClients() {
  return {
    activities: createRouterClient(activitiesNamespace),
    exams: createRouterClient(examsNamespace),
    modules: createRouterClient(modulesNamespace),
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

describe("unlocking a module by passing an exam (exams.md §4)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let clients: ReturnType<typeof createClients>;
  let programId: string;
  let basicsId: string;
  let advancedId: string;
  let examId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-exam-unlock-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    clients = createClients();
    programId = (await clients.programs.create({ name: "Medicina" })).id;
    basicsId = (await clients.modules.create({ name: "Básico", programId })).id;
    advancedId = (await clients.modules.create({ name: "Avançado", programId }))
      .id;
    await clients.quiz.createWithQuestions({
      moduleId: basicsId,
      questions: QUESTIONS,
      title: "Quiz básico",
    });
    examId = (
      await clients.exams.create({
        moduleIds: [basicsId],
        passingScore: 70,
        programId,
        questionCount: 1,
        timeLimitMinutes: null,
        title: "Prova do básico",
      })
    ).id;
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  const attempt = (correct: number, total: number) =>
    clients.exams.saveAttempt({
      correct,
      durationMs: 1000,
      examId,
      startedAt: new Date(),
      total,
    });

  it("saves the rule and reads it back (AC-1)", async () => {
    await clients.modules.setUnlockRule({
      id: advancedId,
      mode: "exam",
      requiredIds: [examId],
    });

    expect(await clients.modules.getUnlockRule({ id: advancedId })).toEqual({
      mode: "exam",
      requiredIds: [examId],
    });
  });

  it("takes exactly one exam of the same program, not one drawing from the module itself (AC-1)", async () => {
    const other = await clients.programs.create({ name: "Direito" });
    const otherModule = await clients.modules.create({
      name: "Civil",
      programId: other.id,
    });
    await clients.quiz.createWithQuestions({
      moduleId: otherModule.id,
      questions: QUESTIONS,
      title: "Quiz",
    });
    const otherExam = await clients.exams.create({
      moduleIds: [otherModule.id],
      passingScore: 70,
      programId: other.id,
      questionCount: 1,
      timeLimitMinutes: null,
      title: "Outra",
    });

    await expect(
      clients.modules.setUnlockRule({
        id: advancedId,
        mode: "exam",
        requiredIds: [],
      })
    ).rejects.toThrow();
    await expect(
      clients.modules.setUnlockRule({
        id: advancedId,
        mode: "exam",
        requiredIds: [examId, otherExam.id],
      })
    ).rejects.toThrow();
    await expect(
      clients.modules.setUnlockRule({
        id: advancedId,
        mode: "exam",
        requiredIds: [otherExam.id],
      })
    ).rejects.toThrow();
    await expect(
      clients.modules.setUnlockRule({
        id: basicsId,
        mode: "exam",
        requiredIds: [examId],
      })
    ).rejects.toThrow();
  });

  it("is not a rule an activity can have (AC-5)", async () => {
    const pdf = await clients.activities.create({
      moduleId: advancedId,
      title: "Capítulo",
      type: "pdf",
    });

    await expect(
      clients.activities.setUnlockRule({
        id: pdf.id,
        mode: "exam" as never,
        requiredIds: [examId],
      })
    ).rejects.toThrow();
  });

  it("locks the module until an attempt passes (AC-2, AC-4)", async () => {
    await clients.modules.setUnlockRule({
      id: advancedId,
      mode: "exam",
      requiredIds: [examId],
    });

    expect((await clients.review.listLocks()).modules[advancedId]).toEqual({
      locked: true,
      missing: [{ id: examId, kind: "exam" }],
    });

    await attempt(1, 2);
    expect(
      (await clients.review.listLocks()).modules[advancedId]
    ).toBeDefined();

    await attempt(7, 10);
    expect(
      (await clients.review.listLocks()).modules[advancedId]
    ).toBeUndefined();
  });

  it("stops locking when the exam is deleted (AC-2)", async () => {
    await clients.modules.setUnlockRule({
      id: advancedId,
      mode: "exam",
      requiredIds: [examId],
    });

    await clients.exams.softDelete({ id: examId });

    expect(
      (await clients.review.listLocks()).modules[advancedId]
    ).toBeUndefined();
  });
});
