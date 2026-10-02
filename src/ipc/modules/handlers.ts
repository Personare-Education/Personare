import { os } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { modules as modulesTable } from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  cascadeRestoreModule,
  cascadeSoftDeleteModule,
} from "@/ipc/shared/cascade-soft-delete";
import {
  createModuleInputSchema,
  listModulesInputSchema,
  softDeleteModuleInputSchema,
  updateModuleInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const list = os.input(listModulesInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();

  return db
    .select()
    .from(modulesTable)
    .where(
      and(
        eq(modulesTable.programId, input.programId),
        isNull(modulesTable.deletedAt)
      )
    )
    .orderBy(asc(modulesTable.name))
    .all();
});

export const create = os.input(createModuleInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  const now = new Date();

  return db
    .insert(modulesTable)
    .values({
      createdAt: now,
      name: input.name,
      programId: input.programId,
      updatedAt: now,
    })
    .returning()
    .get();
});

export const update = os.input(updateModuleInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();

  return db
    .update(modulesTable)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(modulesTable.id, input.id))
    .returning()
    .get();
});

/** Undoes softDelete: the row and what its deletion hid (docs/specs/safety-net.md). */
export const restore = os
  .input(softDeleteModuleInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const row = db
      .select({ deletedAt: modulesTable.deletedAt })
      .from(modulesTable)
      .where(eq(modulesTable.id, input.id))
      .get();
    if (!row?.deletedAt) {
      return;
    }

    db.update(modulesTable)
      .set({ deletedAt: null })
      .where(eq(modulesTable.id, input.id))
      .run();

    cascadeRestoreModule(db, input.id, row.deletedAt);
  });

export const softDelete = os
  .input(softDeleteModuleInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    db.update(modulesTable)
      .set({ deletedAt: now })
      .where(eq(modulesTable.id, input.id))
      .run();

    cascadeSoftDeleteModule(db, input.id, now);
  });
