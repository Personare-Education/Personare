import path from "node:path";

/** The path rules of the given system, not of the one running this code. */
export function pathFor(platform: NodeJS.Platform): typeof path.posix {
  return platform === "win32" ? path.win32 : path.posix;
}

/**
 * What the app and the MCP server agree on (docs/specs/mcp-create-program.md):
 * the note the app leaves in its data folder while it is open, with where its
 * bridge listens and the session's token. Nothing here may import Electron:
 * the MCP server runs in Claude Desktop's Node, not in the app.
 */

export const MCP_BRIDGE_FILE = "mcp-bridge.json";

export interface McpBridgeInfo {
  /** A Windows named pipe, or a Unix socket's path elsewhere. */
  address: string;
  /** Sent as "Bearer <token>"; a new one each time the app opens. */
  token: string;
}

/**
 * Personare's data folder, as Electron's app.getPath("userData") names it
 * from the productName, found without Electron.
 */
export function personareDataDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDir: string
): string {
  const { join } = pathFor(platform);
  if (platform === "win32") {
    return join(
      env.APPDATA ?? join(homeDir, "AppData", "Roaming"),
      "Personare"
    );
  }
  if (platform === "darwin") {
    return join(homeDir, "Library", "Application Support", "Personare");
  }
  return join(env.XDG_CONFIG_HOME ?? join(homeDir, ".config"), "Personare");
}
