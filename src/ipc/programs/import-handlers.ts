import { os } from "@orpc/server";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  importProgram,
  previewProgramImport,
  undoProgramImport,
} from "@/ipc/shared/program-import";
import {
  importProgramInputSchema,
  undoProgramImportInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

/** Imports a program, new or completing one (docs/specs/program-import.md §2). */
export const importFromMarkdown = os
  .input(importProgramInputSchema)
  .handler(({ input }) =>
    importProgram(requireDatabaseClient(), input.markdown)
  );

/** What importing would do, writing nothing (§3 AC-2). */
export const previewImport = os
  .input(importProgramInputSchema)
  .handler(({ input }) =>
    previewProgramImport(requireDatabaseClient(), input.markdown)
  );

/** Takes away what one import created (§2 AC-6). */
export const undoImport = os
  .input(undoProgramImportInputSchema)
  .handler(({ input }) => {
    undoProgramImport(requireDatabaseClient(), input.created);
  });
