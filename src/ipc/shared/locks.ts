import { isNull } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  modules as modulesTable,
  unlockRequirements as unlockRequirementsTable,
} from "@/database/schema";
import { loadExamPasses } from "@/ipc/shared/exams";
import { computeLocks, type Locks } from "@/utils/unlock";

/**
 * Every lock, from the live rows (docs/specs/sequences-and-locks.md §2):
 * deleted modules and activities are left out, so rules pointing at them
 * stop counting.
 */
export function loadLocks(db: DatabaseClient): Locks {
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

  return computeLocks({
    activities,
    exams: loadExamPasses(db),
    modules,
    requirements,
  });
}
