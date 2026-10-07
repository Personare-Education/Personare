import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { setDatabaseClient } from "@/ipc/database/state";
import { settings as settingsNamespace } from "@/ipc/settings";

/**
 * RED phase (Issue #20, Spec Driven TDD): src/ipc/settings does not exist
 * yet, nor does the app_settings table it needs (AC-1's migration, which is
 * the Developer's job to generate via drizzle-kit -- deliberately not
 * generated here). Every test below is expected to fail until the
 * Developer implements the "settings" oRPC namespace, per
 * docs/specs/issue-20-notificacao-boot.md AC-4, mirroring the pattern
 * already used by src/ipc/review and other single-table namespaces.
 *
 * setAutoStart also calls Electron's app.setLoginItemSettings so the OS
 * login item registration takes effect immediately, not just on next boot.
 * That API only exists inside the real Electron main process -- mirroring
 * the precedent already established by src/tests/unit/dialog-ipc.test.ts
 * (which mocks electron's `dialog` for the same reason), this suite mocks
 * electron's `app.setLoginItemSettings`.
 */

const setLoginItemSettingsMock = vi.fn();

vi.mock("electron", () => ({
  app: {
    setLoginItemSettings: (...args: unknown[]) =>
      setLoginItemSettingsMock(...args),
  },
}));

const SETTINGS_ROUTER_REGISTRATION_PATTERN = /\bsettings\b/;

describe("settings IPC namespace (Issue #20)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;
  let client: ReturnType<typeof createRouterClient<typeof settingsNamespace>>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-settings-ipc-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    client = createRouterClient(settingsNamespace);
    setLoginItemSettingsMock.mockReset();
  });

  afterEach(() => {
    // Windows refuses to delete a sqlite file while a connection to it is
    // still open (EPERM), unlike Linux/macOS -- close it first.
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(SETTINGS_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes get and setAutoStart procedures", () => {
    expect(settingsNamespace.get).toBeDefined();
    expect(settingsNamespace.setAutoStart).toBeDefined();
  });

  describe("get", () => {
    it("creates the singleton row with autoStartEnabled false when it does not exist yet", async () => {
      await expect(client.get()).resolves.toMatchObject({
        autoStartEnabled: false,
      });
    });

    it("returns the previously saved value on a subsequent call, without resetting it", async () => {
      await client.get();
      await client.setAutoStart({ enabled: true });

      await expect(client.get()).resolves.toMatchObject({
        autoStartEnabled: true,
      });
    });

    it("is idempotent -- calling get() multiple times before any write does not change the stored default", async () => {
      await client.get();
      await client.get();

      await expect(client.get()).resolves.toMatchObject({
        autoStartEnabled: false,
      });
    });
  });

  describe("setAutoStart", () => {
    it("persists autoStartEnabled as true", async () => {
      await client.setAutoStart({ enabled: true });

      await expect(client.get()).resolves.toMatchObject({
        autoStartEnabled: true,
      });
    });

    it("persists autoStartEnabled as false", async () => {
      await client.setAutoStart({ enabled: true });
      await client.setAutoStart({ enabled: false });

      await expect(client.get()).resolves.toMatchObject({
        autoStartEnabled: false,
      });
    });

    it("calls app.setLoginItemSettings with openAtLogin matching the new value, so the OS registration takes effect immediately", async () => {
      await client.setAutoStart({ enabled: true });

      expect(setLoginItemSettingsMock).toHaveBeenCalledWith({
        openAtLogin: true,
      });

      await client.setAutoStart({ enabled: false });

      expect(setLoginItemSettingsMock).toHaveBeenCalledWith({
        openAtLogin: false,
      });
    });

    it("creates the singleton row even if get() was never called first (upsert, not update-only)", async () => {
      await client.setAutoStart({ enabled: true });

      await expect(client.get()).resolves.toMatchObject({
        autoStartEnabled: true,
      });
    });
  });

  /** docs/specs/prerelease-updates.md AC-1, AC-2 */
  describe("setTestPrereleases", () => {
    it("tests pre-releases by default", async () => {
      await expect(client.get()).resolves.toMatchObject({
        testPrereleases: true,
      });
    });

    it("saves the choice", async () => {
      await client.setTestPrereleases({ enabled: false });

      await expect(client.get()).resolves.toMatchObject({
        autoStartEnabled: false,
        testPrereleases: false,
      });
    });
  });

  describe("sounds (gamification.md §2 AC-3)", () => {
    it("are on by default and keep what is saved", async () => {
      await expect(client.get()).resolves.toMatchObject({
        soundsEnabled: true,
      });

      await client.setSoundsEnabled({ enabled: false });

      await expect(client.get()).resolves.toMatchObject({
        soundsEnabled: false,
      });
    });
  });
});
