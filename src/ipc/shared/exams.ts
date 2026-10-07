import { and, eq, isNull } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  examAttempts as examAttemptsTable,
  examModules as examModulesTable,
  exams as examsTable,
  modules as modulesTable,
} from "@/database/schema";
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
