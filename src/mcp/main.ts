import os from "node:os";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { personareDataDir } from "./bridge-protocol";
import { createPersonareMcpServer } from "./server";

/**
 * The MCP server's entry: Claude Desktop starts it and talks over stdio
 * (docs/specs/mcp-create-program.md). PERSONARE_DATA_DIR points it at another
 * data folder, e.g. a development profile.
 */
const dataDir =
  process.env.PERSONARE_DATA_DIR ||
  personareDataDir(process.platform, process.env, os.homedir());

await createPersonareMcpServer({ dataDir }).connect(new StdioServerTransport());
