import { os } from "@orpc/server";
import { eq } from "drizzle-orm";
import { app } from "electron";
import type { DatabaseClient } from "@/database/client";
import { appSettings as appSettingsTable } from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import { DEFAULT_DESIRED_RETENTION } from "@/utils/fsrs";
import {
  setAutoStartInputSchema,
  setDesiredRetentionInputSchema,
  setSoundsEnabledInputSchema,
  setTestPrereleasesInputSchema,
} from "./schemas";

const SETTINGS_ROW_ID = 1;

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

/**
 * Shared with the main process (src/main.ts syncs the OS login item with
 * this on every boot) so there is only one implementation of "read the
 * singleton row, creating it with the default if it doesn't exist yet" --
 * the main process calls this directly against its own DatabaseClient
 * rather than round-tripping through oRPC just to talk to itself.
 */
export function getOrCreateAppSettings(db: DatabaseClient) {
  db.insert(appSettingsTable)
    .values({ autoStartEnabled: false, id: SETTINGS_ROW_ID })
    .onConflictDoNothing()
    .run();

  const row = db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, SETTINGS_ROW_ID))
    .get();

  return {
    autoStartEnabled: row?.autoStartEnabled ?? false,
    desiredRetention: row?.desiredRetention ?? DEFAULT_DESIRED_RETENTION,
    soundsEnabled: row?.soundsEnabled ?? true,
    testPrereleases: row?.testPrereleases ?? true,
  };
}

export const get = os.handler(() =>
  getOrCreateAppSettings(requireDatabaseClient())
);

export const setAutoStart = os
  .input(setAutoStartInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    db.insert(appSettingsTable)
      .values({ autoStartEnabled: input.enabled, id: SETTINGS_ROW_ID })
      .onConflictDoUpdate({
        set: { autoStartEnabled: input.enabled },
        target: appSettingsTable.id,
      })
      .run();

    app.setLoginItemSettings({ openAtLogin: input.enabled });
  });

/** The update channel, read at launch (docs/specs/prerelease-updates.md). */
export const setTestPrereleases = os
  .input(setTestPrereleasesInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    getOrCreateAppSettings(db);
    db.update(appSettingsTable)
      .set({ testPrereleases: input.enabled })
      .where(eq(appSettingsTable.id, SETTINGS_ROW_ID))
      .run();
  });

/** Settings → Sounds (docs/specs/gamification.md §2 AC-3). */
export const setSoundsEnabled = os
  .input(setSoundsEnabledInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    getOrCreateAppSettings(db);
    db.update(appSettingsTable)
      .set({ soundsEnabled: input.enabled })
      .where(eq(appSettingsTable.id, SETTINGS_ROW_ID))
      .run();
  });

/**
 * The retention FSRS schedules for, from the next rating on
 * (docs/specs/desired-retention.md AC-1).
 */
export const setDesiredRetention = os
  .input(setDesiredRetentionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    getOrCreateAppSettings(db);
    db.update(appSettingsTable)
      .set({ desiredRetention: input.desiredRetention })
      .where(eq(appSettingsTable.id, SETTINGS_ROW_ID))
      .run();
  });
