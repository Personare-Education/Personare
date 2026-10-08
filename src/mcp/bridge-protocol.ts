import path from "node:path";

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
  if (platform === "win32") {
    return path.join(
      env.APPDATA ?? path.join(homeDir, "AppData", "Roaming"),
      "Personare"
    );
  }
  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "Personare");
  }
  return path.join(
    env.XDG_CONFIG_HOME ?? path.join(homeDir, ".config"),
    "Personare"
  );
}
