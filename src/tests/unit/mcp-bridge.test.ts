import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { programs as programsTable } from "@/database/schema";
import { setDatabaseClient } from "@/ipc/database/state";
import { type McpBridge, startMcpBridge } from "@/main/mcp-bridge";
import { createBridgeClient, readBridgeInfo } from "@/mcp/bridge-client";
import { MCP_BRIDGE_FILE } from "@/mcp/bridge-protocol";

/**
 * RED phase (docs/specs/mcp-create-program.md AC-1 to AC-3): the main
 * process serves the IPC's own handlers on a named pipe (a Unix socket off
 * Windows), only to calls that carry the session's token.
 */

const HEX_TOKEN = /^[0-9a-f]{64}$/;

let tmpDir: string;
let dataDir: string;
let db: DatabaseClient;
let bridge: McpBridge | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-mcp-bridge-"));
  dataDir = path.join(tmpDir, "data");
  fs.mkdirSync(dataDir);
  db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
  runMigrations(db);
  setDatabaseClient(db);
});

afterEach(async () => {
  await bridge?.close();
  bridge = undefined;
  // Windows won't delete an open sqlite file (EPERM): close it first.
  db.$client.close();
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

describe("the MCP bridge", () => {
  it("announces itself in the data folder, and takes it back on close (AC-3)", async () => {
    bridge = await startMcpBridge({ dataDir });

    const info = readBridgeInfo(dataDir);
    expect(info?.address).toBeTruthy();
    expect(info?.token).toMatch(HEX_TOKEN);

    await bridge.close();
    bridge = undefined;
    expect(fs.existsSync(path.join(dataDir, MCP_BRIDGE_FILE))).toBe(false);
  });

  it("creates a program through the IPC's own handler (AC-1)", async () => {
    const onDataChanged = vi.fn();
    bridge = await startMcpBridge({ dataDir, onDataChanged });
    const info = readBridgeInfo(dataDir);
    if (!info) {
      throw new Error("no bridge info");
    }

    const program = await createBridgeClient(info).programs.create({
      color: "#3b6cf6",
      icon: "Sigma",
      name: "Cálculo I",
    });

    expect(program).toMatchObject({
      color: "#3b6cf6",
      icon: "Sigma",
      name: "Cálculo I",
    });
    const rows = db.select().from(programsTable).all();
    expect(rows.map((row) => row.name)).toEqual(["Cálculo I"]);
    expect(onDataChanged).toHaveBeenCalledWith("programs");
  });

  it("refuses a call without the session's token, and writes nothing (AC-2)", async () => {
    bridge = await startMcpBridge({ dataDir });
    const info = readBridgeInfo(dataDir);
    if (!info) {
      throw new Error("no bridge info");
    }

    await expect(
      createBridgeClient({ ...info, token: "0".repeat(64) }).programs.create({
        name: "Intruso",
      })
    ).rejects.toThrow();
    expect(db.select().from(programsTable).all()).toEqual([]);
  });
});
