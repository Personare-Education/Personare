import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import {
  examAttempts as examAttemptsTable,
  examModules as examModulesTable,
  exams as examsTable,
  quizQuestions as quizQuestionsTable,
} from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { exams as examsNamespace } from "@/ipc/exams";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";
import { collectBackupData, restoreBackupData } from "@/utils/backup-data";

/**
 * RED phase (docs/specs/exams.md, "1. Dados"): exams, their modules,
 * standalone questions, the draw and the attempts, at the data layer.
 */

function createClients() {
  return {
    activities: createRouterClient(activitiesNamespace),
    exams: createRouterClient(examsNamespace),
    modules: createRouterClient(modulesNamespace),
    programs: createRouterClient(programsNamespace),
    quiz: createRouterClient(quizNamespace),
  };
}

function questions(count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) => ({
    options: [
      { isCorrect: true, text: `${prefix} certa ${i}` },
      { isCorrect: false, text: `${prefix} errada ${i}` },
    ],
    text: `${prefix} pergunta ${i}`,
  }));
}

describe("exams: data (exams.md §1)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let clients: ReturnType<typeof createClients>;
  let programId: string;
  /** Has a quiz with 4 questions. */
  let anatomyId: string;
  /** Has a quiz with 3 questions, inside a sequence. */
  let physiologyId: string;
  /** Has no quiz at all. */
  let emptyId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-exams-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    clients = createClients();
    programId = (await clients.programs.create({ name: "Medicina" })).id;
    anatomyId = (await clients.modules.create({ name: "Anatomia", programId }))
      .id;
    physiologyId = (
      await clients.modules.create({ name: "Fisiologia", programId })
    ).id;
    emptyId = (await clients.modules.create({ name: "Vazio", programId })).id;

    await clients.quiz.createWithQuestions({
      moduleId: anatomyId,
      questions: questions(4, "anat"),
      title: "Quiz de anatomia",
    });
    const sequence = await clients.activities.create({
      moduleId: physiologyId,
      title: "Revisão",
      type: "group",
    });
    await clients.quiz.createWithQuestions({
      moduleId: physiologyId,
      parentActivityId: sequence.id,
      questions: questions(3, "fisio"),
      title: "Quiz de fisiologia",
    });
    await clients.activities.create({
      moduleId: emptyId,
      title: "Capítulo",
      type: "pdf",
    });
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  const newExam = (overrides: Record<string, unknown> = {}) =>
    clients.exams.create({
      moduleIds: [anatomyId, physiologyId],
      passingScore: 70,
      programId,
      questionCount: 4,
      timeLimitMinutes: null,
      title: "Prova 1",
      ...overrides,
    });

  describe("create and update (AC-1, AC-2)", () => {
    it("creates an exam with its modules", async () => {
      const exam = await newExam({ timeLimitMinutes: 30 });

      expect(exam).toMatchObject({
        passingScore: 70,
        programId,
        questionCount: 4,
        timeLimitMinutes: 30,
        title: "Prova 1",
      });
      expect(
        db
          .select()
          .from(examModulesTable)
          .all()
          .map((row) => row.moduleId)
          .sort()
      ).toEqual([anatomyId, physiologyId].sort());
    });

    it("needs at least one module", async () => {
      await expect(newExam({ moduleIds: [] })).rejects.toThrow();
    });

    it("refuses a module without a quiz with questions", async () => {
      await expect(newExam({ moduleIds: [emptyId] })).rejects.toThrow();
    });

    it("refuses a module of another program", async () => {
      const other = await clients.programs.create({ name: "Direito" });
      const otherModule = await clients.modules.create({
        name: "Civil",
        programId: other.id,
      });
      await clients.quiz.createWithQuestions({
        moduleId: otherModule.id,
        questions: questions(1, "civil"),
        title: "Quiz",
      });

      await expect(
        newExam({ moduleIds: [anatomyId, otherModule.id] })
      ).rejects.toThrow();
    });

    it("refuses an empty count, a zero time limit and an out-of-range score", async () => {
      await expect(newExam({ questionCount: 0 })).rejects.toThrow();
      await expect(newExam({ timeLimitMinutes: 0 })).rejects.toThrow();
      await expect(newExam({ passingScore: 0 })).rejects.toThrow();
      await expect(newExam({ passingScore: 101 })).rejects.toThrow();
    });

    it("updates the fields and swaps the modules", async () => {
      const exam = await newExam();

      await clients.exams.update({
        id: exam.id,
        moduleIds: [physiologyId],
        passingScore: 60,
        questionCount: 2,
        timeLimitMinutes: 15,
        title: "Prova final",
      });

      const [listed] = await clients.exams.list({ programId });
      expect(listed).toMatchObject({
        moduleIds: [physiologyId],
        passingScore: 60,
        questionCount: 2,
        timeLimitMinutes: 15,
        title: "Prova final",
      });
    });
  });

  describe("list (AC-3)", () => {
    it("lists the program's live exams in creation order, with their summary", async () => {
      const first = await newExam({ title: "A" });
      const second = await newExam({ title: "B" });
      await clients.quiz.createQuestion({ examId: second.id, text: "Avulsa" });

      const listed = await clients.exams.list({ programId });

      expect(listed.map((row) => row.id)).toEqual([first.id, second.id]);
      expect(listed[0]).toMatchObject({
        bestScore: null,
        lastAttemptAt: null,
        passed: false,
        standaloneCount: 0,
      });
      expect(listed[1].standaloneCount).toBe(1);
    });

    it("says the best score, the last attempt and whether it passed", async () => {
      const exam = await newExam({ passingScore: 75 });
      await clients.exams.saveAttempt({
        correct: 2,
        durationMs: 1000,
        examId: exam.id,
        startedAt: new Date("2026-10-01T10:00:00Z"),
        total: 4,
      });
      await clients.exams.saveAttempt({
        correct: 3,
        durationMs: 1000,
        examId: exam.id,
        startedAt: new Date("2026-10-02T10:00:00Z"),
        total: 4,
      });

      const [listed] = await clients.exams.list({ programId });

      expect(listed.bestScore).toBe(0.75);
      expect(listed.passed).toBe(true);
      expect(listed.lastAttemptAt).toEqual(new Date("2026-10-02T10:00:00Z"));
    });
  });

  it("says how many questions an attempt would have (§3 AC-1)", async () => {
    const big = await newExam({ questionCount: 20 });
    const small = await newExam({ moduleIds: [anatomyId], questionCount: 2 });
    await clients.quiz.createQuestion({ examId: small.id, text: "Avulsa" });

    const listed = await clients.exams.list({ programId });

    expect(listed.find((row) => row.id === big.id)?.availableCount).toBe(7);
    expect(listed.find((row) => row.id === small.id)?.availableCount).toBe(3);
  });

  it("says how many quiz questions each module has (AC-4)", async () => {
    const eligible = await clients.exams.listEligibleModules({ programId });

    expect(eligible).toEqual([
      { id: anatomyId, name: "Anatomia", questionCount: 4 },
      { id: physiologyId, name: "Fisiologia", questionCount: 3 },
      { id: emptyId, name: "Vazio", questionCount: 0 },
    ]);
  });

  it("deletes and restores an exam (AC-5)", async () => {
    const exam = await newExam();

    await clients.exams.softDelete({ id: exam.id });
    expect(await clients.exams.list({ programId })).toEqual([]);

    await clients.exams.restore({ id: exam.id });
    expect(
      (await clients.exams.list({ programId })).map((row) => row.id)
    ).toEqual([exam.id]);
  });

  describe("standalone questions (AC-6)", () => {
    it("creates and lists questions that belong to the exam", async () => {
      const exam = await newExam();

      const question = await clients.quiz.createQuestion({
        examId: exam.id,
        text: "Quantos ossos?",
      });
      await clients.quiz.createOption({
        isCorrect: true,
        questionId: question.id,
        text: "206",
      });

      const listed = await clients.quiz.listQuestions({ examId: exam.id });
      expect(listed.map((row) => row.text)).toEqual(["Quantos ossos?"]);
      expect(listed[0]).toMatchObject({ activityId: null, examId: exam.id });
      expect(
        await clients.quiz.listOptions({ questionId: question.id })
      ).toHaveLength(1);
    });

    it("takes an activity or an exam, never both or neither", async () => {
      const exam = await newExam();
      const [activity] = await clients.activities.list({ moduleId: anatomyId });

      await expect(
        clients.quiz.createQuestion({
          activityId: activity.id,
          examId: exam.id,
          text: "?",
        })
      ).rejects.toThrow();
      await expect(
        clients.quiz.createQuestion({ text: "?" })
      ).rejects.toThrow();
    });

    it("keeps the quiz's own questions apart from the exam's", async () => {
      const exam = await newExam();
      await clients.quiz.createQuestion({ examId: exam.id, text: "Avulsa" });
      const [activity] = await clients.activities.list({ moduleId: anatomyId });

      const quizQuestions = await clients.quiz.listQuestions({
        activityId: activity.id,
      });
      expect(quizQuestions).toHaveLength(4);
    });
  });

  describe("draw (AC-8)", () => {
    it("draws the count from the modules, plus every standalone question, with options", async () => {
      const exam = await newExam({ questionCount: 4 });
      const standalone = await clients.quiz.createQuestion({
        examId: exam.id,
        text: "Avulsa",
      });
      await clients.quiz.createOption({
        isCorrect: true,
        questionId: standalone.id,
        text: "Sim",
      });

      const drawn = await clients.exams.draw({ examId: exam.id });

      expect(drawn).toHaveLength(5);
      expect(drawn.map((question) => question.id)).toContain(standalone.id);
      expect(drawn.filter((q) => q.text.startsWith("anat"))).toHaveLength(2);
      expect(drawn.filter((q) => q.text.startsWith("fisio"))).toHaveLength(2);
      for (const question of drawn) {
        expect(question.options.length).toBeGreaterThan(0);
        expect(question.options[0]).toHaveProperty("isCorrect");
      }
    });

    it("leaves out deleted questions, quizzes and modules", async () => {
      const exam = await newExam({ questionCount: 20 });
      const [quiz] = await clients.activities.list({ moduleId: anatomyId });
      const [doomed] = await clients.quiz.listQuestions({
        activityId: quiz.id,
      });
      await clients.quiz.softDeleteQuestion({ id: doomed.id });

      expect(await clients.exams.draw({ examId: exam.id })).toHaveLength(6);

      await clients.modules.softDelete({ id: physiologyId });
      expect(await clients.exams.draw({ examId: exam.id })).toHaveLength(3);

      await clients.activities.softDelete({ id: quiz.id });
      expect(await clients.exams.draw({ examId: exam.id })).toHaveLength(0);
    });
  });

  it("saves attempts and lists them newest first (AC-9)", async () => {
    const exam = await newExam();
    await clients.exams.saveAttempt({
      correct: 1,
      durationMs: 5000,
      examId: exam.id,
      startedAt: new Date("2026-10-01T10:00:00Z"),
      total: 4,
    });
    await clients.exams.saveAttempt({
      correct: 4,
      durationMs: 3000,
      examId: exam.id,
      startedAt: new Date("2026-10-03T10:00:00Z"),
      total: 4,
    });

    const attempts = await clients.exams.listAttempts({ examId: exam.id });

    expect(attempts.map((row) => row.correct)).toEqual([4, 1]);
    expect(attempts[0]).toMatchObject({ durationMs: 3000, total: 4 });
  });

  it("carries exams in the backup, and restores a backup without them (AC-10)", async () => {
    const exam = await newExam();
    await clients.quiz.createQuestion({ examId: exam.id, text: "Avulsa" });
    await clients.exams.saveAttempt({
      correct: 3,
      durationMs: 1000,
      examId: exam.id,
      startedAt: new Date(),
      total: 4,
    });

    const data = collectBackupData(db);
    expect(data.exams).toHaveLength(1);
    expect(data.examModules).toHaveLength(2);
    expect(data.examAttempts).toHaveLength(1);

    restoreBackupData(db, data);
    expect(db.select().from(examsTable).all()).toHaveLength(1);
    expect(db.select().from(examModulesTable).all()).toHaveLength(2);
    expect(db.select().from(examAttemptsTable).all()).toHaveLength(1);
    expect(
      db
        .select()
        .from(quizQuestionsTable)
        .all()
        .filter((row) => row.examId === exam.id)
    ).toHaveLength(1);

    const {
      examAttempts: _attempts,
      examModules: _modules,
      exams: _exams,
      ...older
    } = data;
    const olderQuestions = older.quizQuestions.filter(
      (row) => row.examId === null
    );
    restoreBackupData(db, { ...older, quizQuestions: olderQuestions });
    expect(db.select().from(examsTable).all()).toHaveLength(0);
    expect(await clients.exams.list({ programId })).toEqual([]);
  });

  it("keeps the quizzes of a database made before exams (AC-10)", () => {
    const folder = path.join(tmpDir, "drizzle");
    fs.cpSync(path.resolve(process.cwd(), "drizzle"), folder, {
      recursive: true,
    });
    const journalPath = path.join(folder, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    const before = journal.entries.filter(
      (entry: { tag: string }) => entry.tag < "0013"
    );
    fs.writeFileSync(
      journalPath,
      JSON.stringify({ ...journal, entries: before })
    );
    const old = createDatabaseClient(path.join(tmpDir, "old.sqlite"));
    runMigrations(old, folder);
    old.run(
      sql`INSERT INTO programs (id, name, created_at, updated_at) VALUES ('p', 'P', 0, 0)`
    );
    old.run(
      sql`INSERT INTO modules (id, name, program_id, created_at, updated_at) VALUES ('m', 'M', 'p', 0, 0)`
    );
    old.run(
      sql`INSERT INTO activities (id, title, type, module_id, created_at, updated_at) VALUES ('a', 'Quiz', 'quiz', 'm', 0, 0)`
    );
    old.run(
      sql`INSERT INTO quiz_questions (id, activity_id, text, created_at, updated_at) VALUES ('q', 'a', 'Pergunta', 0, 0)`
    );
    old.run(
      sql`INSERT INTO quiz_options (id, question_id, text, is_correct, created_at, updated_at) VALUES ('o', 'q', 'Certa', 1, 0, 0)`
    );

    runMigrations(old);

    expect(old.select().from(quizQuestionsTable).all()).toEqual([
      expect.objectContaining({ activityId: "a", examId: null, id: "q" }),
    ]);
    expect(
      old.all(sql`SELECT id FROM quiz_options WHERE question_id = 'q'`)
    ).toEqual([{ id: "o" }]);
    expect(old.all(sql`PRAGMA foreign_key_check`)).toEqual([]);
    old.$client.close();
  });
});
