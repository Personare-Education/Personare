import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { setDatabaseClient } from "@/ipc/database/state";
import { bridgeAddress, startMcpBridge } from "@/main/mcp-bridge";
import { createBridgeClient, readBridgeInfo } from "@/mcp/bridge-client";
import { personareDataDir } from "@/mcp/bridge-protocol";

/**
 * RED phase (docs/specs/mcp-release.md AC-2, AC-3): the bridge on Windows,
 * macOS and Linux. The CI runs this file on all three.
 */

const PIPE = /^\\\\\.\\pipe\\personare-mcp-[0-9a-f-]{36}$/;
/** macOS's sun_path is 104 bytes, the terminating NUL included. */
const MAX_SOCKET_BYTES = 103;
const SOCKET_IN_TEMP = /personare-mcp-[\w-]+\.sock$/;
/** The permission bits of a mode: rwx for user, group and others. */
const permissions = (mode: number) => mode % 0o1000;

describe("where the bridge listens (AC-2)", () => {
  it("is a new named pipe each time on Windows", () => {
    const first = bridgeAddress(
      "win32",
      "C:\\Users\\ana\\AppData\\Roaming\\Personare"
    );
    const second = bridgeAddress(
      "win32",
      "C:\\Users\\ana\\AppData\\Roaming\\Personare"
    );

    expect(first).toMatch(PIPE);
    expect(second).not.toBe(first);
  });

  it("is a socket in the data folder on Linux and macOS", () => {
    expect(bridgeAddress("linux", "/home/ana/.config/Personare")).toBe(
      "/home/ana/.config/Personare/mcp.sock"
    );
    expect(
      bridgeAddress(
        "darwin",
        "/Users/ana/Library/Application Support/Personare"
      )
    ).toBe("/Users/ana/Library/Application Support/Personare/mcp.sock");
  });

  it("moves to the temp folder when the socket's path would be too long", () => {
    const longHome = `/Users/${"a".repeat(80)}/Library/Application Support/Personare`;

    const address = bridgeAddress("darwin", longHome);

    expect(Buffer.byteLength(address)).toBeLessThanOrEqual(MAX_SOCKET_BYTES);
    expect(address.startsWith(os.tmpdir())).toBe(true);
    expect(address).toMatch(SOCKET_IN_TEMP);
  });
});

describe("the data folder the server reads (AC-3)", () => {
  it("is the one Electron uses on each system", () => {
    expect(
      personareDataDir(
        "win32",
        { APPDATA: "C:\\Users\\ana\\AppData\\Roaming" },
        "C:\\Users\\ana"
      )
    ).toBe("C:\\Users\\ana\\AppData\\Roaming\\Personare");
    expect(personareDataDir("darwin", {}, "/Users/ana")).toBe(
      "/Users/ana/Library/Application Support/Personare"
    );
    expect(personareDataDir("linux", {}, "/home/ana")).toBe(
      "/home/ana/.config/Personare"
    );
    expect(
      personareDataDir(
        "linux",
        { XDG_CONFIG_HOME: "/home/ana/conf" },
        "/home/ana"
      )
    ).toBe("/home/ana/conf/Personare");
  });
});

describe.skipIf(process.platform === "win32")("the Unix socket (AC-2)", () => {
  let tmpDir: string;
  let db: DatabaseClient;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmcp-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("is only the user's, and replaces one a crash left behind", async () => {
    fs.writeFileSync(path.join(tmpDir, "mcp.sock"), "left by a crash");

    const bridge = await startMcpBridge({ dataDir: tmpDir });
    try {
      const info = readBridgeInfo(tmpDir);
      if (!info) {
        throw new Error("no bridge info");
      }
      expect(permissions(fs.statSync(info.address).mode)).toBe(0o600);
      await expect(createBridgeClient(info).programs.list()).resolves.toEqual(
        []
      );
    } finally {
      await bridge.close();
    }
  });
});
