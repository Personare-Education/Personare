import { os } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  activities as activitiesTable,
  modules as modulesTable,
} from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  cascadeRestoreActivity,
  cascadeSoftDeleteActivity,
} from "@/ipc/shared/cascade-soft-delete";
import {
  assertCanHoldActivity,
  markActivityCompleted,
  nextActivityPosition,
  getUnlockRule as readUnlockRule,
  reorderRows,
  setUnlockRule as saveUnlockRule,
} from "@/ipc/shared/sequences";
import {
  completeActivityInputSchema,
  createActivityInputSchema,
  getUnlockRuleInputSchema,
  listActivitiesInputSchema,
  listByProgramInputSchema,
  reorderActivitiesInputSchema,
  setUnlockRuleInputSchema,
  softDeleteActivityInputSchema,
  updateActivityInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const list = os.input(listActivitiesInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();

  return (
    db
      .select()
      .from(activitiesTable)
      .where(
        and(
          eq(activitiesTable.moduleId, input.moduleId),
          input.parentActivityId
            ? eq(activitiesTable.parentActivityId, input.parentActivityId)
            : isNull(activitiesTable.parentActivityId),
          isNull(activitiesTable.deletedAt)
        )
      )
      // Their own order, then creation (docs/specs/sequences-and-locks.md §1).
      .orderBy(asc(activitiesTable.position), asc(activitiesTable.createdAt))
      .all()
  );
});

export const create = os
  .input(createActivityInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();
    const parentActivityId = input.parentActivityId ?? null;
    if (parentActivityId) {
      assertCanHoldActivity(db, input.moduleId, parentActivityId, input.type);
    }

    return db
      .insert(activitiesTable)
      .values({
        createdAt: now,
        filePath: input.filePath ?? null,
        moduleId: input.moduleId,
        parentActivityId,
        // New ones go at the end of their list (§1 AC-2).
        position: nextActivityPosition(db, input.moduleId, parentActivityId),
        title: input.title,
        type: input.type,
        updatedAt: now,
        url: input.url ?? null,
      })
      .returning()
      .get();
  });

export const update = os
  .input(updateActivityInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .update(activitiesTable)
      .set({
        filePath: input.filePath ?? null,
        title: input.title,
        type: input.type,
        updatedAt: new Date(),
        url: input.url ?? null,
      })
      .where(eq(activitiesTable.id, input.id))
      .returning()
      .get();
  });

/** Undoes softDelete: the row and what its deletion hid (docs/specs/safety-net.md). */
export const restore = os
  .input(softDeleteActivityInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const row = db
      .select({ deletedAt: activitiesTable.deletedAt })
      .from(activitiesTable)
      .where(eq(activitiesTable.id, input.id))
      .get();
    if (!row?.deletedAt) {
      return;
    }

    db.update(activitiesTable)
      .set({ deletedAt: null })
      .where(eq(activitiesTable.id, input.id))
      .run();

    cascadeRestoreActivity(db, input.id, row.deletedAt);
  });

export const softDelete = os
  .input(softDeleteActivityInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    db.update(activitiesTable)
      .set({ deletedAt: now })
      .where(eq(activitiesTable.id, input.id))
      .run();

    cascadeSoftDeleteActivity(db, input.id, now);
  });

/** Saves a module's (or a group's) new order (§1 AC-3). */
export const reorder = os
  .input(reorderActivitiesInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    reorderRows(
      db,
      activitiesTable,
      and(
        eq(activitiesTable.moduleId, input.moduleId),
        input.parentActivityId
          ? eq(activitiesTable.parentActivityId, input.parentActivityId)
          : isNull(activitiesTable.parentActivityId)
      ),
      input.ids
    );
  });

/** Replaces the activity's unlock rule (§1 AC-5). */
export const setUnlockRule = os
  .input(setUnlockRuleInputSchema)
  .handler(({ input }) => {
    saveUnlockRule(
      requireDatabaseClient(),
      "activity",
      input.id,
      input.mode,
      input.requiredIds
    );
  });

/** A sub-activity done inside its group (§1 AC-6). */
export const complete = os
  .input(completeActivityInputSchema)
  .handler(({ input }) => {
    markActivityCompleted(requireDatabaseClient(), input.id, new Date());
  });

/**
 * Every live activity of a program, with its module, in screen order: what
 * an unlock rule can require (docs/specs/sequences-and-locks.md §4 AC-1).
 */
export const listByProgram = os
  .input(listByProgramInputSchema)
  .handler(({ input }) =>
    requireDatabaseClient()
      .select({
        id: activitiesTable.id,
        moduleId: modulesTable.id,
        moduleName: modulesTable.name,
        parentActivityId: activitiesTable.parentActivityId,
        title: activitiesTable.title,
        type: activitiesTable.type,
        unlockMode: activitiesTable.unlockMode,
      })
      .from(activitiesTable)
      .innerJoin(modulesTable, eq(modulesTable.id, activitiesTable.moduleId))
      .where(
        and(
          eq(modulesTable.programId, input.programId),
          isNull(modulesTable.deletedAt),
          isNull(activitiesTable.deletedAt)
        )
      )
      .orderBy(
        asc(modulesTable.position),
        asc(modulesTable.createdAt),
        asc(activitiesTable.position),
        asc(activitiesTable.createdAt)
      )
      .all()
  );

/** The activity's rule as saved, for its dialog (§4 AC-1). */
export const getUnlockRule = os
  .input(getUnlockRuleInputSchema)
  .handler(({ input }) =>
    readUnlockRule(requireDatabaseClient(), "activity", input.id)
  );
