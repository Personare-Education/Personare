import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { DatabaseClient } from "./client";

export function resolveMigrationsFolder(options: {
  isPackaged: boolean;
  resourcesPath: string;
}): string {
  return options.isPackaged
    ? path.join(options.resourcesPath, "drizzle")
    : path.resolve(process.cwd(), "drizzle");
}

export function runMigrations(
  db: DatabaseClient,
  migrationsFolder: string = path.resolve(process.cwd(), "drizzle")
) {
  // The migrator runs inside a transaction, where a migration's own
  // `PRAGMA foreign_keys=OFF` does nothing; rebuilding a table that others
  // point at (quiz_questions, docs/specs/exams.md) then fails on COMMIT.
  // SQLite's way: keys off around the migration, on again after.
  const keysWereOn = db.$client.pragma("foreign_keys", { simple: true }) === 1;
  db.$client.pragma("foreign_keys = OFF");
  try {
    migrate(db, { migrationsFolder });
  } finally {
    if (keysWereOn) {
      db.$client.pragma("foreign_keys = ON");
    }
  }
}
