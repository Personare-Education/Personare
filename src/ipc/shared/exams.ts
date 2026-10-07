import { and, eq, isNull } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  examAttempts as examAttemptsTable,
  examModules as examModulesTable,
  exams as examsTable,
} from "@/database/schema";
import type { LockExam } from "@/utils/unlock";

/**
 * Every live exam and whether an attempt has passed it -- right answers
 * at or above its passing score (docs/specs/exams.md §4 AC-2).
 */
export function loadExamPasses(db: DatabaseClient): LockExam[] {
  const passingScoreById = new Map(
    db
      .select({ id: examsTable.id, passingScore: examsTable.passingScore })
      .from(examsTable)
      .where(isNull(examsTable.deletedAt))
      .all()
      .map((row) => [row.id, row.passingScore])
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

  return [...passingScoreById.keys()].map((id) => ({
    id,
    passed: passed.has(id),
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
