import { isNull } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  modules as modulesTable,
  unlockRequirements as unlockRequirementsTable,
} from "@/database/schema";
import { loadLockExams } from "@/ipc/shared/exams";
import {
  computeLocks,
  findLockCycle,
  type LockInput,
  type Locks,
} from "@/utils/unlock";

/**
 * Every lock, from the live rows (docs/specs/sequences-and-locks.md §2):
 * deleted modules and activities are left out, so rules pointing at them
 * stop counting.
 */
export function loadLockInput(db: DatabaseClient): LockInput {
  const modules = db
    .select({
      id: modulesTable.id,
      position: modulesTable.position,
      programId: modulesTable.programId,
      unlockMode: modulesTable.unlockMode,
    })
    .from(modulesTable)
    .where(isNull(modulesTable.deletedAt))
    .all();
  const activities = db
    .select({
      completedAt: activitiesTable.completedAt,
      id: activitiesTable.id,
      moduleId: activitiesTable.moduleId,
      parentActivityId: activitiesTable.parentActivityId,
      position: activitiesTable.position,
      unlockMode: activitiesTable.unlockMode,
    })
    .from(activitiesTable)
    .where(isNull(activitiesTable.deletedAt))
    .all();
  const requirements = db
    .select({
      requiredId: unlockRequirementsTable.requiredId,
      subjectId: unlockRequirementsTable.subjectId,
      subjectKind: unlockRequirementsTable.subjectKind,
    })
    .from(unlockRequirementsTable)
    .all();

  return { activities, exams: loadLockExams(db), modules, requirements };
}

export function loadLocks(db: DatabaseClient): Locks {
  return computeLocks(loadLockInput(db));
}

/**
 * Refuses a module's or an exam's new rule when it would make it wait for
 * itself, locked for good (docs/specs/exam-locks.md AC-4).
 */
export function assertNoLockCycle(
  db: DatabaseClient,
  subject: { id: string; kind: "exam" | "module" },
  mode: string,
  requiredIds: string[]
): void {
  const input = loadLockInput(db);
  const requirements = [
    ...input.requirements.filter((row) => row.subjectId !== subject.id),
    ...requiredIds.map((requiredId) => ({
      requiredId,
      subjectId: subject.id,
      subjectKind: subject.kind,
    })),
  ];
  const proposed: LockInput =
    subject.kind === "module"
      ? {
          ...input,
          modules: input.modules.map((row) =>
            row.id === subject.id ? { ...row, unlockMode: mode } : row
          ),
          requirements,
        }
      : {
          ...input,
          exams: input.exams?.map((row) =>
            row.id === subject.id ? { ...row, unlockMode: mode } : row
          ),
          requirements,
        };
  if (findLockCycle(proposed, subject.id)) {
    throw new Error("This rule would keep it locked for good");
  }
}
