import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { programs as programsTable } from "@/database/schema";
import { setDatabaseClient } from "@/ipc/database/state";
import { type McpBridge, startMcpBridge } from "@/main/mcp-bridge";
import { MCP_BRIDGE_FILE } from "@/mcp/bridge-protocol";
import { createPersonareMcpServer } from "@/mcp/server";

/**
 * RED phase (docs/specs/mcp-create-program.md AC-4, AC-5): the MCP server's
 * create_program tool, as an MCP client (Claude Desktop) sees it.
 */

let tmpDir: string;
let dataDir: string;
let db: DatabaseClient;
let bridge: McpBridge | undefined;
let client: Client;

async function connect() {
  const server = createPersonareMcpServer({ dataDir });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
}

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as { text?: string; type: string }[];
  return content.map((part) => part.text ?? "").join("\n");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-mcp-server-"));
  dataDir = path.join(tmpDir, "data");
  fs.mkdirSync(dataDir);
  db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
  runMigrations(db);
  setDatabaseClient(db);
});

afterEach(async () => {
  await client?.close();
  await bridge?.close();
  bridge = undefined;
  // Windows won't delete an open sqlite file (EPERM): close it first.
  db.$client.close();
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

describe("the create_program tool", () => {
  it("is listed with a required name and an optional color and icon (AC-4)", async () => {
    await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "create_program");

    expect(tool?.description).toBeTruthy();
    expect(tool?.inputSchema.required).toEqual(["name"]);
    expect(Object.keys(tool?.inputSchema.properties ?? {}).sort()).toEqual([
      "color",
      "icon",
      "name",
    ]);
  });

  it("creates the program in the open app and says so (AC-4)", async () => {
    bridge = await startMcpBridge({ dataDir });
    await connect();

    const result = await client.callTool({
      arguments: { name: "Anatomia" },
      name: "create_program",
    });

    expect(result.isError).toBeFalsy();
    const [row] = db.select().from(programsTable).all();
    expect(row.name).toBe("Anatomia");
    expect(text(result)).toContain("Anatomia");
    expect(text(result)).toContain(row.id);
  });

  it("asks to open Personare when the app is closed (AC-5)", async () => {
    await connect();

    const result = await client.callTool({
      arguments: { name: "Anatomia" },
      name: "create_program",
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("Abra o Personare e tente de novo.");
  });

  it("asks the same when the app closed without taking its note back (AC-5)", async () => {
    bridge = await startMcpBridge({ dataDir });
    const note = fs.readFileSync(path.join(dataDir, MCP_BRIDGE_FILE), "utf8");
    await bridge.close();
    bridge = undefined;
    fs.writeFileSync(path.join(dataDir, MCP_BRIDGE_FILE), note);
    await connect();

    const result = await client.callTool({
      arguments: { name: "Anatomia" },
      name: "create_program",
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("Abra o Personare e tente de novo.");
    expect(db.select().from(programsTable).all()).toEqual([]);
  });
});

describe("the program choices the tool offers", () => {
  it("are the app's own icons and colors", async () => {
    const { PROGRAM_ICONS, PROGRAM_COLORS } = await import(
      "@/constants/program-appearance"
    );
    const palette = await import("@/constants/program-palette");

    expect(palette.PROGRAM_ICON_NAMES).toEqual(
      PROGRAM_ICONS.map(({ name }) => name)
    );
    expect(palette.PROGRAM_COLORS).toBe(PROGRAM_COLORS);
  });
});
