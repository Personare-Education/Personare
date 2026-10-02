import { os } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  modules as modulesTable,
  programs as programsTable,
} from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  cascadeRestoreModule,
  cascadeSoftDeleteModule,
} from "@/ipc/shared/cascade-soft-delete";
import {
  createProgramInputSchema,
  softDeleteProgramInputSchema,
  updateProgramInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const list = os.handler(() => {
  const db = requireDatabaseClient();

  return db
    .select()
    .from(programsTable)
    .where(isNull(programsTable.deletedAt))
    .orderBy(asc(programsTable.name))
    .all();
});

export const create = os
  .input(createProgramInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    return db
      .insert(programsTable)
      .values({
        color: input.color ?? null,
        createdAt: now,
        icon: input.icon ?? null,
        name: input.name,
        updatedAt: now,
      })
      .returning()
      .get();
  });

export const update = os
  .input(updateProgramInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .update(programsTable)
      .set({
        color: input.color ?? null,
        icon: input.icon ?? null,
        name: input.name,
        updatedAt: new Date(),
      })
      .where(eq(programsTable.id, input.id))
      .returning()
      .get();
  });

/** Undoes softDelete: the row and what its deletion hid (docs/specs/safety-net.md). */
export const restore = os
  .input(softDeleteProgramInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const row = db
      .select({ deletedAt: programsTable.deletedAt })
      .from(programsTable)
      .where(eq(programsTable.id, input.id))
      .get();
    if (!row?.deletedAt) {
      return;
    }
    const { deletedAt } = row;

    db.update(programsTable)
      .set({ deletedAt: null })
      .where(eq(programsTable.id, input.id))
      .run();

    const moduleIds = db
      .select({ id: modulesTable.id })
      .from(modulesTable)
      .where(eq(modulesTable.programId, input.id))
      .all()
      .map((module) => module.id);

    for (const moduleId of moduleIds) {
      db.update(modulesTable)
        .set({ deletedAt: null })
        .where(
          and(
            eq(modulesTable.id, moduleId),
            eq(modulesTable.deletedAt, deletedAt)
          )
        )
        .run();

      cascadeRestoreModule(db, moduleId, deletedAt);
    }
  });

export const softDelete = os
  .input(softDeleteProgramInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    db.update(programsTable)
      .set({ deletedAt: now })
      .where(eq(programsTable.id, input.id))
      .run();

    const moduleIds = db
      .select({ id: modulesTable.id })
      .from(modulesTable)
      .where(eq(modulesTable.programId, input.id))
      .all()
      .map((row) => row.id);

    for (const moduleId of moduleIds) {
      db.update(modulesTable)
        .set({ deletedAt: now })
        .where(
          and(eq(modulesTable.id, moduleId), isNull(modulesTable.deletedAt))
        )
        .run();

      cascadeSoftDeleteModule(db, moduleId, now);
    }
  });
