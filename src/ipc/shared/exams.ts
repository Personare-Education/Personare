import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  examAttempts as examAttemptsTable,
  examModules as examModulesTable,
  exams as examsTable,
  modules as modulesTable,
  quizQuestions as quizQuestionsTable,
  unlockRequirements as unlockRequirementsTable,
} from "@/database/schema";
import { assertNoLockCycle } from "@/ipc/shared/locks";
import type { LockExam } from "@/utils/unlock";

/**
 * Every live exam, whether an attempt has passed it -- right answers at or
 * above its passing score (docs/specs/exams.md §4 AC-2) -- and its own rule
 * with the live modules it draws from (docs/specs/exam-locks.md).
 */
export function loadLockExams(db: DatabaseClient): LockExam[] {
  const rows = db
    .select({
      id: examsTable.id,
      passingScore: examsTable.passingScore,
      unlockMode: examsTable.unlockMode,
    })
    .from(examsTable)
    .where(isNull(examsTable.deletedAt))
    .all();
  const passingScoreById = new Map(
    rows.map((row) => [row.id, row.passingScore])
  );
  const passed = new Set(
    db
      .select()
      .from(examAttemptsTable)
      .all()
      .filter((attempt) => {
        const passingScore = passingScoreById.get(attempt.examId);
        return (
          passingScore !== undefined &&
          attempt.total > 0 &&
          attempt.correct * 100 >= passingScore * attempt.total
        );
      })
      .map((attempt) => attempt.examId)
  );
  const sources = db
    .select({
      examId: examModulesTable.examId,
      moduleId: examModulesTable.moduleId,
    })
    .from(examModulesTable)
    .innerJoin(modulesTable, eq(modulesTable.id, examModulesTable.moduleId))
    .where(isNull(modulesTable.deletedAt))
    .all();

  return rows.map((row) => ({
    id: row.id,
    moduleIds: sources
      .filter((source) => source.examId === row.id)
      .map((source) => source.moduleId),
    passed: passed.has(row.id),
    unlockMode: row.unlockMode,
  }));
}

/**
 * A module may wait for one live exam of its own program that does not
 * draw from it -- it would never unlock (docs/specs/exams.md §4 AC-1).
 */
export function assertUnlockExam(
  db: DatabaseClient,
  moduleId: string,
  programId: string,
  requiredIds: string[]
): void {
  const [examId] = requiredIds;
  const exam =
    requiredIds.length === 1
      ? db
          .select({ id: examsTable.id })
          .from(examsTable)
          .where(
            and(
              eq(examsTable.id, examId),
              eq(examsTable.programId, programId),
              isNull(examsTable.deletedAt)
            )
          )
          .get()
      : undefined;
  const drawsFromModule =
    exam !== undefined &&
    db
      .select({ id: examModulesTable.id })
      .from(examModulesTable)
      .where(
        and(
          eq(examModulesTable.examId, examId),
          eq(examModulesTable.moduleId, moduleId)
        )
      )
      .get() !== undefined;
  if (!exam || drawsFromModule) {
    throw new Error(
      "A module waits for one exam of its program that does not draw from it"
    );
  }
}

/**
 * The live quiz questions of each live module, in creation order: from
 * every live quiz in it, first level or inside a sequence
 * (docs/specs/exams.md §1 AC-4, AC-8).
 */
export function quizQuestionIdsByModule(
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

/**
 * What an exam's rule can take (docs/specs/exam-locks.md AC-1): live
 * modules of its program for "all"/"any" (at least one), one other live
 * exam of its program for "exam", nothing otherwise.
 */
function examRuleList(
  db: DatabaseClient,
  exam: { id: string; programId: string },
  mode: string,
  requiredIds: string[]
): string[] {
  const ids = [...new Set(requiredIds)];
  if (mode === "all" || mode === "any") {
    const found = db
      .select({ id: modulesTable.id })
      .from(modulesTable)
      .where(
        and(
          inArray(modulesTable.id, ids.length > 0 ? ids : [""]),
          eq(modulesTable.programId, exam.programId),
          isNull(modulesTable.deletedAt)
        )
      )
      .all();
    if (ids.length === 0 || found.length !== ids.length) {
      throw new Error("The rule takes modules of the exam's program");
    }
    return ids;
  }
  if (mode === "exam") {
    const [requiredId] = ids;
    const found =
      ids.length === 1 && requiredId !== exam.id
        ? db
            .select({ id: examsTable.id })
            .from(examsTable)
            .where(
              and(
                eq(examsTable.id, requiredId),
                eq(examsTable.programId, exam.programId),
                isNull(examsTable.deletedAt)
              )
            )
            .get()
        : undefined;
    if (!found) {
      throw new Error("The rule takes one other exam of the program");
    }
    return ids;
  }
  return [];
}

/**
 * Saves an exam's own rule (docs/specs/exam-locks.md AC-1, AC-4), checking
 * what it takes and that it would not lock anything for good.
 */
export function saveExamUnlockRule(
  db: DatabaseClient,
  examId: string,
  mode: string,
  requiredIds: string[]
): void {
  const exam = db
    .select({ id: examsTable.id, programId: examsTable.programId })
    .from(examsTable)
    .where(and(eq(examsTable.id, examId), isNull(examsTable.deletedAt)))
    .get();
  if (!exam) {
    throw new Error("The exam does not exist");
  }
  const list = examRuleList(db, exam, mode, requiredIds);
  assertNoLockCycle(db, { id: exam.id, kind: "exam" }, mode, list);

  const now = new Date();
  db.transaction((tx) => {
    tx.update(examsTable)
      .set({ unlockMode: mode, updatedAt: now })
      .where(eq(examsTable.id, exam.id))
      .run();
    tx.delete(unlockRequirementsTable)
      .where(eq(unlockRequirementsTable.subjectId, exam.id))
      .run();
    if (list.length > 0) {
      tx.insert(unlockRequirementsTable)
        .values(
          list.map((requiredId) => ({
            createdAt: now,
            requiredId,
            subjectId: exam.id,
            subjectKind: "exam",
          }))
        )
        .run();
    }
  });
}
