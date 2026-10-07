import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { exams as examsTable } from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { exams as examsNamespace } from "@/ipc/exams";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";
import { review as reviewNamespace } from "@/ipc/review";
import { collectBackupData, restoreBackupData } from "@/utils/backup-data";

/**
 * RED phase (docs/specs/exam-locks.md): an exam's own unlock rule.
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

describe("an exam's own unlock rule (exam-locks.md)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let clients: ReturnType<typeof createClients>;
  let programId: string;
  let basicsId: string;
  let advancedId: string;
  let basicsQuizId: string;
  let firstExamId: string;
  let secondExamId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-exam-locks-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    clients = createClients();
    programId = (await clients.programs.create({ name: "Medicina" })).id;
    basicsId = (await clients.modules.create({ name: "Básico", programId })).id;
    advancedId = (await clients.modules.create({ name: "Avançado", programId }))
      .id;
    basicsQuizId = (
      await clients.quiz.createWithQuestions({
        moduleId: basicsId,
        questions: QUESTIONS,
        title: "Quiz básico",
      })
    ).id;
    await clients.quiz.createWithQuestions({
      moduleId: advancedId,
      questions: QUESTIONS,
      title: "Quiz avançado",
    });
    const exam = (title: string) =>
      clients.exams.create({
        moduleIds: [basicsId],
        passingScore: 70,
        programId,
        questionCount: 1,
        timeLimitMinutes: null,
        title,
      });
    firstExamId = (await exam("Prova 1")).id;
    secondExamId = (await exam("Prova 2")).id;
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  const examLock = async (id: string) =>
    (await clients.review.listLocks()).exams?.[id];

  it("is free by default, and saves and reads back a rule (AC-1)", async () => {
    expect(await examLock(firstExamId)).toBeUndefined();
    expect(await clients.exams.getUnlockRule({ id: firstExamId })).toEqual({
      mode: "none",
      requiredIds: [],
    });

    await clients.exams.setUnlockRule({
      id: firstExamId,
      mode: "all",
      requiredIds: [basicsId, advancedId],
    });

    expect(await clients.exams.getUnlockRule({ id: firstExamId })).toEqual({
      mode: "all",
      requiredIds: [basicsId, advancedId],
    });
  });

  it("checks what a rule takes (AC-1)", async () => {
    const other = await clients.programs.create({ name: "Direito" });
    const otherModule = await clients.modules.create({
      name: "Civil",
      programId: other.id,
    });

    await expect(
      clients.exams.setUnlockRule({
        id: firstExamId,
        mode: "all",
        requiredIds: [],
      })
    ).rejects.toThrow();
    await expect(
      clients.exams.setUnlockRule({
        id: firstExamId,
        mode: "any",
        requiredIds: [otherModule.id],
      })
    ).rejects.toThrow();
    await expect(
      clients.exams.setUnlockRule({
        id: firstExamId,
        mode: "exam",
        requiredIds: [firstExamId],
      })
    ).rejects.toThrow();
    await expect(
      clients.exams.setUnlockRule({
        id: firstExamId,
        mode: "exam",
        requiredIds: [secondExamId, basicsId],
      })
    ).rejects.toThrow();
  });

  it("waits for its own modules, and unlocks once they are done (AC-2)", async () => {
    await clients.exams.setUnlockRule({
      id: firstExamId,
      mode: "sources",
      requiredIds: [],
    });

    expect(await examLock(firstExamId)).toEqual({
      locked: true,
      missing: [{ id: basicsId, kind: "module" }],
    });

    await clients.activities.complete({ id: basicsQuizId });
    expect(await examLock(firstExamId)).toBeUndefined();
  });

  it("waits for another exam to be passed (AC-2)", async () => {
    await clients.exams.setUnlockRule({
      id: secondExamId,
      mode: "exam",
      requiredIds: [firstExamId],
    });

    expect((await examLock(secondExamId))?.missing).toEqual([
      { id: firstExamId, kind: "exam" },
    ]);

    await clients.exams.saveAttempt({
      correct: 1,
      durationMs: 1000,
      examId: firstExamId,
      startedAt: new Date(),
      total: 1,
    });
    expect(await examLock(secondExamId)).toBeUndefined();
  });

  it("will not draw a locked exam (AC-3)", async () => {
    await clients.exams.setUnlockRule({
      id: firstExamId,
      mode: "sources",
      requiredIds: [],
    });

    await expect(clients.exams.draw({ examId: firstExamId })).rejects.toThrow();
  });

  it("refuses a rule that would lock something for good (AC-4)", async () => {
    await clients.exams.setUnlockRule({
      id: secondExamId,
      mode: "exam",
      requiredIds: [firstExamId],
    });
    await expect(
      clients.exams.setUnlockRule({
        id: firstExamId,
        mode: "exam",
        requiredIds: [secondExamId],
      })
    ).rejects.toThrow();

    // The module waits for the exam, so the exam cannot wait for the module.
    await clients.modules.setUnlockRule({
      id: advancedId,
      mode: "exam",
      requiredIds: [firstExamId],
    });
    await expect(
      clients.exams.setUnlockRule({
        id: firstExamId,
        mode: "all",
        requiredIds: [advancedId],
      })
    ).rejects.toThrow();

    // And from the module's side.
    await clients.exams.setUnlockRule({
      id: secondExamId,
      mode: "all",
      requiredIds: [basicsId],
    });
    await expect(
      clients.modules.setUnlockRule({
        id: basicsId,
        mode: "exam",
        requiredIds: [secondExamId],
      })
    ).rejects.toThrow();
  });

  it("carries the rule in the backup; an older one restores free (AC-7)", async () => {
    await clients.exams.setUnlockRule({
      id: firstExamId,
      mode: "sources",
      requiredIds: [],
    });

    const data = collectBackupData(db);
    restoreBackupData(db, data);
    expect(await clients.exams.getUnlockRule({ id: firstExamId })).toEqual({
      mode: "sources",
      requiredIds: [],
    });

    const older = {
      ...data,
      exams: data.exams?.map(({ unlockMode: _mode, ...exam }) => exam),
    };
    restoreBackupData(db, older as typeof data);
    expect(
      db
        .select()
        .from(examsTable)
        .all()
        .map((row) => row.unlockMode)
    ).toEqual(["none", "none"]);
  });
});
