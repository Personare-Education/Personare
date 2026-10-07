import { and, eq, isNull, max } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
  modules as modulesTable,
  unlockRequirements as unlockRequirementsTable,
} from "@/database/schema";
import { assertUnlockExam } from "@/ipc/shared/exams";

/** How an activity or module unlocks (docs/specs/sequences-and-locks.md). */
export const UNLOCK_MODES = ["none", "previous", "any", "all"] as const;
/** A module can also wait for an exam (docs/specs/exams.md §4). */
export const MODULE_UNLOCK_MODES = [...UNLOCK_MODES, "exam"] as const;
export type UnlockMode = (typeof MODULE_UNLOCK_MODES)[number];

/** The activity type of a group of sub-activities. */
export const GROUP_ACTIVITY_TYPE = "group";

/** What a group cannot hold: another group, or a deck with its own schedule. */
const NOT_IN_A_GROUP = new Set([GROUP_ACTIVITY_TYPE, "flashcard_deck"]);

/**
 * Where a new activity goes: inside a group of the same module, checked;
 * throws when the parent is not a group or the type cannot be in one.
 */
export function assertCanHoldActivity(
  db: DatabaseClient,
  moduleId: string,
  parentActivityId: string,
  type: string
): void {
  if (NOT_IN_A_GROUP.has(type)) {
    throw new Error(`A group cannot hold an activity of type "${type}"`);
  }
  const parent = db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.id, parentActivityId))
    .get();
  if (
    !parent ||
    parent.deletedAt ||
    parent.type !== GROUP_ACTIVITY_TYPE ||
    parent.moduleId !== moduleId
  ) {
    throw new Error("Sub-activities go inside a group of the same module");
  }
}

/** The position after the last activity of a module (or of a group in it). */
export function nextActivityPosition(
  db: DatabaseClient,
  moduleId: string,
  parentActivityId: string | null
): number {
  const row = db
    .select({ last: max(activitiesTable.position) })
    .from(activitiesTable)
    .where(
      and(
        eq(activitiesTable.moduleId, moduleId),
        parentActivityId
          ? eq(activitiesTable.parentActivityId, parentActivityId)
          : isNull(activitiesTable.parentActivityId),
        isNull(activitiesTable.deletedAt)
      )
    )
    .get();
  return row?.last === null || row?.last === undefined ? 0 : row.last + 1;
}

/** The position after the last module of a program. */
export function nextModulePosition(
  db: DatabaseClient,
  programId: string
): number {
  const row = db
    .select({ last: max(modulesTable.position) })
    .from(modulesTable)
    .where(
      and(eq(modulesTable.programId, programId), isNull(modulesTable.deletedAt))
    )
    .get();
  return row?.last === null || row?.last === undefined ? 0 : row.last + 1;
}

/** The program an activity or a module belongs to, or null if it is gone. */
function programOf(
  db: DatabaseClient,
  kind: "activity" | "module",
  id: string
): string | null {
  if (kind === "module") {
    const row = db
      .select({
        deletedAt: modulesTable.deletedAt,
        programId: modulesTable.programId,
      })
      .from(modulesTable)
      .where(eq(modulesTable.id, id))
      .get();
    return row && !row.deletedAt ? row.programId : null;
  }
  const row = db
    .select({
      deletedAt: activitiesTable.deletedAt,
      programId: modulesTable.programId,
    })
    .from(activitiesTable)
    .innerJoin(modulesTable, eq(modulesTable.id, activitiesTable.moduleId))
    .where(eq(activitiesTable.id, id))
    .get();
  return row && !row.deletedAt ? row.programId : null;
}

/**
 * Replaces an activity's or a module's unlock rule (§1 AC-5). A list only
 * takes items of the same kind and program, never the item itself; for
 * "none" and "previous" it is empty.
 */
export function setUnlockRule(
  db: DatabaseClient,
  kind: "activity" | "module",
  id: string,
  mode: UnlockMode,
  requiredIds: string[]
): void {
  const programId = programOf(db, kind, id);
  if (!programId) {
    throw new Error(`The ${kind} does not exist`);
  }
  if (mode === "exam") {
    if (kind !== "module") {
      throw new Error("Only a module can wait for an exam");
    }
    assertUnlockExam(db, id, programId, requiredIds);
  }
  const takesActivitiesOrModules = mode === "any" || mode === "all";
  let list: string[] = [];
  if (takesActivitiesOrModules) {
    list = [...new Set(requiredIds)];
  } else if (mode === "exam") {
    list = requiredIds;
  }
  for (const requiredId of takesActivitiesOrModules ? list : []) {
    if (requiredId === id || programOf(db, kind, requiredId) !== programId) {
      throw new Error(
        `An unlock rule takes ${kind}s of the same program, not itself`
      );
    }
  }

  const now = new Date();
  db.transaction((tx) => {
    if (kind === "module") {
      tx.update(modulesTable)
        .set({ unlockMode: mode, updatedAt: now })
        .where(eq(modulesTable.id, id))
        .run();
    } else {
      tx.update(activitiesTable)
        .set({ unlockMode: mode, updatedAt: now })
        .where(eq(activitiesTable.id, id))
        .run();
    }
    tx.delete(unlockRequirementsTable)
      .where(eq(unlockRequirementsTable.subjectId, id))
      .run();
    if (list.length > 0) {
      tx.insert(unlockRequirementsTable)
        .values(
          list.map((requiredId) => ({
            createdAt: now,
            requiredId,
            subjectId: id,
            subjectKind: kind,
          }))
        )
        .run();
    }
  });
}

/** Records an activity's first completion; later ones keep that date (§1 AC-6). */
export function markActivityCompleted(
  db: DatabaseClient,
  activityId: string,
  at: Date
): void {
  db.update(activitiesTable)
    .set({ completedAt: at })
    .where(
      and(
        eq(activitiesTable.id, activityId),
        isNull(activitiesTable.completedAt)
      )
    )
    .run();
}

/** The deck a flashcard belongs to, to mark it done on its first card. */
export function activityOfFlashcard(
  db: DatabaseClient,
  flashcardId: string
): string | null {
  return (
    db
      .select({ activityId: flashcardsTable.activityId })
      .from(flashcardsTable)
      .where(eq(flashcardsTable.id, flashcardId))
      .get()?.activityId ?? null
  );
}

/** Saves a new order: each id gets its index as its position. */
export function reorderRows(
  db: DatabaseClient,
  table: typeof activitiesTable | typeof modulesTable,
  scope: ReturnType<typeof and>,
  ids: string[]
): void {
  db.transaction((tx) => {
    ids.forEach((id, position) => {
      tx.update(table)
        .set({ position })
        .where(and(eq(table.id, id), scope))
        .run();
    });
  });
}

/** An activity's or a module's rule as it is saved (§4 AC-1). */
export function getUnlockRule(
  db: DatabaseClient,
  kind: "activity" | "module",
  id: string
): { mode: string; requiredIds: string[] } {
  const row =
    kind === "module"
      ? db
          .select({ mode: modulesTable.unlockMode })
          .from(modulesTable)
          .where(eq(modulesTable.id, id))
          .get()
      : db
          .select({ mode: activitiesTable.unlockMode })
          .from(activitiesTable)
          .where(eq(activitiesTable.id, id))
          .get();
  const requiredIds = db
    .select({ requiredId: unlockRequirementsTable.requiredId })
    .from(unlockRequirementsTable)
    .where(eq(unlockRequirementsTable.subjectId, id))
    .all()
    .map((requirement) => requirement.requiredId);
  return { mode: row?.mode ?? "none", requiredIds };
}
