import { os } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { modules as modulesTable } from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  cascadeRestoreModule,
  cascadeSoftDeleteModule,
} from "@/ipc/shared/cascade-soft-delete";
import {
  nextModulePosition,
  getUnlockRule as readUnlockRule,
  reorderRows,
  setUnlockRule as saveUnlockRule,
} from "@/ipc/shared/sequences";
import {
  createModuleInputSchema,
  getModuleUnlockRuleInputSchema,
  listModulesInputSchema,
  reorderModulesInputSchema,
  setModuleUnlockRuleInputSchema,
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

  return (
    db
      .select()
      .from(modulesTable)
      .where(
        and(
          eq(modulesTable.programId, input.programId),
          isNull(modulesTable.deletedAt)
        )
      )
      // Their own order (docs/specs/sequences-and-locks.md §1); migrated
      // programs start from the name order they had.
      .orderBy(asc(modulesTable.position), asc(modulesTable.createdAt))
      .all()
  );
});

export const create = os.input(createModuleInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  const now = new Date();

  return db
    .insert(modulesTable)
    .values({
      createdAt: now,
      name: input.name,
      position: nextModulePosition(db, input.programId),
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

/** Saves the program's new module order (§1 AC-3). */
export const reorder = os
  .input(reorderModulesInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    reorderRows(
      db,
      modulesTable,
      eq(modulesTable.programId, input.programId),
      input.ids
    );
  });

/** Replaces the module's unlock rule (§1 AC-5). */
export const setUnlockRule = os
  .input(setModuleUnlockRuleInputSchema)
  .handler(({ input }) => {
    saveUnlockRule(
      requireDatabaseClient(),
      "module",
      input.id,
      input.mode,
      input.requiredIds
    );
  });

/** The module's rule as saved, for its dialog (§4 AC-1). */
export const getUnlockRule = os
  .input(getModuleUnlockRuleInputSchema)
  .handler(({ input }) =>
    readUnlockRule(requireDatabaseClient(), "module", input.id)
  );
