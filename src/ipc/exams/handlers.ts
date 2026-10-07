import { os } from "@orpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  examAttempts as examAttemptsTable,
  examModules as examModulesTable,
  exams as examsTable,
  modules as modulesTable,
  quizOptions as quizOptionsTable,
  quizQuestions as quizQuestionsTable,
} from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import { drawExamQuestions } from "@/utils/exam-draw";
import {
  createExamInputSchema,
  examIdInputSchema,
  examRefInputSchema,
  listExamsInputSchema,
  saveAttemptInputSchema,
  updateExamInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

/**
 * The live quiz questions of each live module, in creation order: from
 * every live quiz in it, first level or inside a sequence
 * (docs/specs/exams.md §1 AC-4, AC-8).
 */
function quizQuestionIdsByModule(
  db: DatabaseClient,
  moduleIds: string[]
): Map<string, string[]> {
  const byModule = new Map<string, string[]>(moduleIds.map((id) => [id, []]));
  if (moduleIds.length === 0) {
    return byModule;
  }
  const rows = db
    .select({
      id: quizQuestionsTable.id,
      moduleId: activitiesTable.moduleId,
    })
    .from(quizQuestionsTable)
    .innerJoin(
      activitiesTable,
      eq(activitiesTable.id, quizQuestionsTable.activityId)
    )
    .innerJoin(modulesTable, eq(modulesTable.id, activitiesTable.moduleId))
    .where(
      and(
        inArray(activitiesTable.moduleId, moduleIds),
        eq(activitiesTable.type, "quiz"),
        isNull(quizQuestionsTable.deletedAt),
        isNull(activitiesTable.deletedAt),
        isNull(modulesTable.deletedAt)
      )
    )
    .orderBy(asc(quizQuestionsTable.createdAt))
    .all();
  for (const row of rows) {
    byModule.get(row.moduleId)?.push(row.id);
  }
  return byModule;
}

function standaloneQuestionIds(db: DatabaseClient, examId: string): string[] {
  return db
    .select({ id: quizQuestionsTable.id })
    .from(quizQuestionsTable)
    .where(
      and(
        eq(quizQuestionsTable.examId, examId),
        isNull(quizQuestionsTable.deletedAt)
      )
    )
    .orderBy(asc(quizQuestionsTable.createdAt))
    .all()
    .map((row) => row.id);
}

/**
 * An exam takes live modules of its own program that have quiz questions
 * (docs/specs/exams.md §1 AC-1).
 */
function assertExamModules(
  db: DatabaseClient,
  programId: string,
  moduleIds: string[]
): void {
  const ids = [...new Set(moduleIds)];
  const rows = db
    .select({ id: modulesTable.id })
    .from(modulesTable)
    .where(
      and(
        inArray(modulesTable.id, ids),
        eq(modulesTable.programId, programId),
        isNull(modulesTable.deletedAt)
      )
    )
    .all();
  const counts = quizQuestionIdsByModule(db, ids);
  if (
    rows.length !== ids.length ||
    ids.some((id) => (counts.get(id) ?? []).length === 0)
  ) {
    throw new Error(
      "An exam takes modules of its program that have a quiz with questions"
    );
  }
}

function replaceExamModules(
  db: DatabaseClient,
  examId: string,
  moduleIds: string[]
): void {
  db.transaction((tx) => {
    tx.delete(examModulesTable)
      .where(eq(examModulesTable.examId, examId))
      .run();
    tx.insert(examModulesTable)
      .values([...new Set(moduleIds)].map((moduleId) => ({ examId, moduleId })))
      .run();
  });
}

/** The exam's modules that are still live, in the program's order. */
function liveExamModuleIds(db: DatabaseClient, examId: string): string[] {
  return db
    .select({ id: modulesTable.id })
    .from(examModulesTable)
    .innerJoin(modulesTable, eq(modulesTable.id, examModulesTable.moduleId))
    .where(
      and(eq(examModulesTable.examId, examId), isNull(modulesTable.deletedAt))
    )
    .orderBy(asc(modulesTable.position), asc(modulesTable.createdAt))
    .all()
    .map((row) => row.id);
}

export const create = os.input(createExamInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  assertExamModules(db, input.programId, input.moduleIds);
  const now = new Date();

  const exam = db
    .insert(examsTable)
    .values({
      createdAt: now,
      passingScore: input.passingScore,
      programId: input.programId,
      questionCount: input.questionCount,
      timeLimitMinutes: input.timeLimitMinutes,
      title: input.title,
      updatedAt: now,
    })
    .returning()
    .get();
  replaceExamModules(db, exam.id, input.moduleIds);

  return exam;
});

export const update = os.input(updateExamInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  const exam = db
    .select({ programId: examsTable.programId })
    .from(examsTable)
    .where(eq(examsTable.id, input.id))
    .get();
  if (!exam) {
    throw new Error("The exam does not exist");
  }
  assertExamModules(db, exam.programId, input.moduleIds);

  db.update(examsTable)
    .set({
      passingScore: input.passingScore,
      questionCount: input.questionCount,
      timeLimitMinutes: input.timeLimitMinutes,
      title: input.title,
      updatedAt: new Date(),
    })
    .where(eq(examsTable.id, input.id))
    .run();
  replaceExamModules(db, input.id, input.moduleIds);
});

/**
 * The program's live exams, oldest first, each with its summary
 * (docs/specs/exams.md §1 AC-3): its modules, how many standalone
 * questions, the best share of right answers, the last attempt and
 * whether it passed.
 */
export const list = os.input(listExamsInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  const rows = db
    .select()
    .from(examsTable)
    .where(
      and(
        eq(examsTable.programId, input.programId),
        isNull(examsTable.deletedAt)
      )
    )
    .orderBy(asc(examsTable.createdAt))
    .all();

  return rows.map((exam) => {
    const attempts = db
      .select()
      .from(examAttemptsTable)
      .where(eq(examAttemptsTable.examId, exam.id))
      .all();
    const scores = attempts.map((attempt) =>
      attempt.total === 0 ? 0 : attempt.correct / attempt.total
    );
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const lastAttemptAt =
      attempts.length > 0
        ? new Date(
            Math.max(...attempts.map((attempt) => attempt.startedAt.getTime()))
          )
        : null;

    const moduleIds = liveExamModuleIds(db, exam.id);
    const inModules = [
      ...quizQuestionIdsByModule(db, moduleIds).values(),
    ].reduce((sum, ids) => sum + ids.length, 0);
    const standaloneCount = standaloneQuestionIds(db, exam.id).length;

    return {
      ...exam,
      // How many an attempt would have now (docs/specs/exams.md §3 AC-1).
      availableCount: Math.min(exam.questionCount, inModules) + standaloneCount,
      bestScore,
      lastAttemptAt,
      moduleIds,
      passed: bestScore !== null && bestScore * 100 >= exam.passingScore,
      standaloneCount,
    };
  });
});

/**
 * Every live module of the program with how many quiz questions it has; the
 * ones with none cannot go in an exam (docs/specs/exams.md §1 AC-4).
 */
export const listEligibleModules = os
  .input(listExamsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const rows = db
      .select({ id: modulesTable.id, name: modulesTable.name })
      .from(modulesTable)
      .where(
        and(
          eq(modulesTable.programId, input.programId),
          isNull(modulesTable.deletedAt)
        )
      )
      .orderBy(asc(modulesTable.position), asc(modulesTable.createdAt))
      .all();
    const counts = quizQuestionIdsByModule(
      db,
      rows.map((row) => row.id)
    );

    return rows.map((row) => ({
      ...row,
      questionCount: (counts.get(row.id) ?? []).length,
    }));
  });

export const softDelete = os.input(examIdInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();

  db.update(examsTable)
    .set({ deletedAt: new Date() })
    .where(eq(examsTable.id, input.id))
    .run();
});

/** Undoes softDelete; its questions and attempts were never hidden. */
export const restore = os.input(examIdInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();

  db.update(examsTable)
    .set({ deletedAt: null })
    .where(eq(examsTable.id, input.id))
    .run();
});

/**
 * An attempt's questions, with their options (docs/specs/exams.md §1
 * AC-8): drawn afresh each time from the exam's live modules, plus every
 * standalone question.
 */
export const draw = os.input(examRefInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  const exam = db
    .select()
    .from(examsTable)
    .where(eq(examsTable.id, input.examId))
    .get();
  if (!exam) {
    throw new Error("The exam does not exist");
  }
  const pools = [
    ...quizQuestionIdsByModule(db, liveExamModuleIds(db, exam.id)),
  ].map(([moduleId, questionIds]) => ({ moduleId, questionIds }));
  const ids = drawExamQuestions({
    pools,
    standaloneIds: standaloneQuestionIds(db, exam.id),
    total: exam.questionCount,
  });
  if (ids.length === 0) {
    return [];
  }

  const questions = new Map(
    db
      .select()
      .from(quizQuestionsTable)
      .where(inArray(quizQuestionsTable.id, ids))
      .all()
      .map((row) => [row.id, row])
  );
  const options = db
    .select()
    .from(quizOptionsTable)
    .where(
      and(
        inArray(quizOptionsTable.questionId, ids),
        isNull(quizOptionsTable.deletedAt)
      )
    )
    .orderBy(asc(quizOptionsTable.createdAt))
    .all();

  return ids.flatMap((id) => {
    const question = questions.get(id);
    return question
      ? [
          {
            id: question.id,
            imagePath: question.imagePath,
            options: options
              .filter((option) => option.questionId === id)
              .map((option) => ({
                id: option.id,
                imagePath: option.imagePath,
                isCorrect: option.isCorrect,
                text: option.text,
              })),
            text: question.text,
          },
        ]
      : [];
  });
});

export const saveAttempt = os
  .input(saveAttemptInputSchema)
  .handler(({ input }) =>
    requireDatabaseClient()
      .insert(examAttemptsTable)
      .values(input)
      .returning()
      .get()
  );

/** Newest first (docs/specs/exams.md §1 AC-9). */
export const listAttempts = os
  .input(examRefInputSchema)
  .handler(({ input }) =>
    requireDatabaseClient()
      .select()
      .from(examAttemptsTable)
      .where(eq(examAttemptsTable.examId, input.examId))
      .orderBy(desc(examAttemptsTable.startedAt))
      .all()
  );
