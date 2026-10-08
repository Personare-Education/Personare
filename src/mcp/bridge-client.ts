import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { BridgeRouter } from "@/main/mcp-bridge";
import { MCP_BRIDGE_FILE, type McpBridgeInfo } from "./bridge-protocol";

/**
 * The MCP server's side of the bridge (docs/specs/mcp-create-program.md):
 * finds the open app's note and calls its handlers over the pipe.
 */

/** The open app's note, or null when the app is not open. */
export function readBridgeInfo(dataDir: string): McpBridgeInfo | null {
  try {
    const info = JSON.parse(
      fs.readFileSync(path.join(dataDir, MCP_BRIDGE_FILE), "utf8")
    ) as Partial<McpBridgeInfo>;
    return info.address && info.token
      ? { address: info.address, token: info.token }
      : null;
  } catch {
    return null;
  }
}

/** fetch() over a named pipe or Unix socket, which Node's fetch can't reach. */
function fetchOverSocket(socketPath: string) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const body = request.body
      ? Buffer.from(await request.arrayBuffer())
      : undefined;
    return await new Promise<Response>((resolve, reject) => {
      const outgoing = http.request(
        {
          headers: Object.fromEntries(request.headers),
          method: request.method,
          path: `${url.pathname}${url.search}`,
          socketPath,
        },
        (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
          incoming.on("end", () => {
            const headers = new Headers();
            for (const [key, value] of Object.entries(incoming.headers)) {
              if (typeof value === "string") {
                headers.set(key, value);
              }
            }
            const status = incoming.statusCode ?? 500;
            const hasBody = status !== 204 && status !== 304;
            resolve(
              new Response(hasBody ? Buffer.concat(chunks) : null, {
                headers,
                status,
              })
            );
          });
          incoming.on("error", reject);
        }
      );
      outgoing.on("error", reject);
      outgoing.end(body);
    });
  };
}

export type BridgeClient = RouterClient<BridgeRouter>;

export function createBridgeClient(info: McpBridgeInfo): BridgeClient {
  const link = new RPCLink({
    fetch: fetchOverSocket(info.address),
    headers: { authorization: `Bearer ${info.token}` },
    // The host is never dialed: the socket is the destination.
    url: "http://personare.local/",
  });
  return createORPCClient(link);
}

/** The pipe isn't there or won't answer: the app is closed. */
export function isAppUnreachable(error: unknown): boolean {
  const code =
    (error as { code?: string; cause?: { code?: string } } | null)?.code ??
    (error as { cause?: { code?: string } } | null)?.cause?.code;
  return (
    code === "ENOENT" ||
    code === "ECONNREFUSED" ||
    code === "EPIPE" ||
    code === "ECONNRESET"
  );
}
