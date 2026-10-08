import path from "node:path";
import { defineConfig } from "vite";

/**
 * The MCP server as one Node file with every dependency inside, for the
 * .mcpb bundle Claude Desktop installs (docs/specs/mcp-create-program.md).
 */
export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "out/mcp/bundle/server",
    rollupOptions: { output: { entryFileNames: "index.mjs", format: "es" } },
    ssr: "src/mcp/main.ts",
    target: "node18",
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  ssr: { noExternal: true, target: "node" },
});
