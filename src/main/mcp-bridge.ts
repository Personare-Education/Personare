import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { RPCHandler } from "@orpc/server/node";
import {
  MCP_BRIDGE_FILE,
  type McpBridgeInfo,
  pathFor,
} from "@/mcp/bridge-protocol";
import { createBridgeRouter, type DataTopic } from "./mcp-bridge-router";

export type { BridgeRouter, DataTopic } from "./mcp-bridge-router";

/**
 * The MCP bridge (docs/specs/mcp-create-program.md): the main process serves
 * the IPC's own handlers to the MCP server, which Claude Desktop runs in a
 * process of its own. Only what the MCP tools need is exposed, and only to
 * calls carrying this session's token.
 */

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

/** macOS's sun_path is 104 bytes, the terminating NUL included. */
const MAX_SOCKET_BYTES = 103;

/**
 * Where the bridge listens (docs/specs/mcp-release.md AC-2): a named pipe on
 * Windows, new each session so no other process can hold it in advance; a
 * Unix socket in the data folder elsewhere, or in the temp folder when that
 * path would pass the socket path limit.
 */
export function bridgeAddress(
  platform: NodeJS.Platform,
  dataDir: string
): string {
  if (platform === "win32") {
    return `\\\\.\\pipe\\personare-mcp-${randomUUID()}`;
  }
  const inData = pathFor(platform).join(dataDir, "mcp.sock");
  if (Buffer.byteLength(inData) <= MAX_SOCKET_BYTES) {
    return inData;
  }
  // One per user, so two people on one machine don't share it.
  const user =
    os.userInfo().uid >= 0 ? String(os.userInfo().uid) : os.userInfo().username;
  return pathFor(platform).join(os.tmpdir(), `personare-mcp-${user}.sock`);
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
  if (platform !== "win32") {
    // Only the user may connect; the token still guards every call.
    fs.chmodSync(info.address, 0o600);
  }

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
