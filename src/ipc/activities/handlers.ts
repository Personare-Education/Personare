import { os } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { activities as activitiesTable } from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  cascadeRestoreActivity,
  cascadeSoftDeleteActivity,
} from "@/ipc/shared/cascade-soft-delete";
import {
  createActivityInputSchema,
  listActivitiesInputSchema,
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

  return db
    .select()
    .from(activitiesTable)
    .where(
      and(
        eq(activitiesTable.moduleId, input.moduleId),
        isNull(activitiesTable.deletedAt)
      )
    )
    .orderBy(asc(activitiesTable.createdAt))
    .all();
});

export const create = os
  .input(createActivityInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    return db
      .insert(activitiesTable)
      .values({
        createdAt: now,
        filePath: input.filePath ?? null,
        moduleId: input.moduleId,
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
