import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { call, os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/node";
import { programs } from "@/ipc/programs";
import { createProgramInputSchema } from "@/ipc/programs/schemas";
import { MCP_BRIDGE_FILE, type McpBridgeInfo } from "@/mcp/bridge-protocol";

/**
 * The MCP bridge (docs/specs/mcp-create-program.md): the main process serves
 * the IPC's own handlers to the MCP server, which Claude Desktop runs in a
 * process of its own. Only what the MCP tools need is exposed, and only to
 * calls carrying this session's token.
 */

/** What changed, so the open window can reload it (AC-6). */
export type DataTopic = "programs";

function createBridgeRouter(onDataChanged: (topic: DataTopic) => void) {
  return {
    programs: {
      create: os.input(createProgramInputSchema).handler(async ({ input }) => {
        const program = await call(programs.create, input);
        onDataChanged("programs");
        return program;
      }),
      list: programs.list,
    },
  };
}

export type BridgeRouter = ReturnType<typeof createBridgeRouter>;

export interface McpBridge {
  close: () => Promise<void>;
  info: McpBridgeInfo;
}

interface StartMcpBridgeOptions {
  /** Where the app keeps its data; the bridge's note goes there. */
  dataDir: string;
  onDataChanged?: (topic: DataTopic) => void;
  platform?: NodeJS.Platform;
}

function bridgeAddress(platform: NodeJS.Platform, dataDir: string): string {
  // A new pipe name each session: another process can't hold it in advance.
  return platform === "win32"
    ? `\\\\.\\pipe\\personare-mcp-${randomUUID()}`
    : path.join(dataDir, "mcp.sock");
}

function hasToken(request: http.IncomingMessage, token: string): boolean {
  const header = request.headers.authorization ?? "";
  const expected = Buffer.from(`Bearer ${token}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function startMcpBridge({
  dataDir,
  onDataChanged = () => undefined,
  platform = process.platform,
}: StartMcpBridgeOptions): Promise<McpBridge> {
  const info: McpBridgeInfo = {
    address: bridgeAddress(platform, dataDir),
    token: randomBytes(32).toString("hex"),
  };
  const handler = new RPCHandler(createBridgeRouter(onDataChanged));
  const server = http.createServer(async (request, response) => {
    if (!hasToken(request, info.token)) {
      response.writeHead(401).end();
      return;
    }
    const { matched } = await handler.handle(request, response, {
      context: {},
    });
    if (!matched) {
      response.writeHead(404).end();
    }
  });

  if (platform !== "win32") {
    // A socket left by a crash would make listen() fail.
    fs.rmSync(info.address, { force: true });
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(info.address, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const notePath = path.join(dataDir, MCP_BRIDGE_FILE);
  fs.writeFileSync(notePath, JSON.stringify(info), { mode: 0o600 });

  return {
    close: async () => {
      // The note first, and synchronously: on quit nothing awaits the rest.
      // Only this session's note: a newer instance may have written its own.
      try {
        const current = JSON.parse(
          fs.readFileSync(notePath, "utf8")
        ) as McpBridgeInfo;
        if (current.token === info.token) {
          fs.rmSync(notePath, { force: true });
        }
      } catch {
        // No note left: nothing to take back.
      }
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
    info,
  };
}
