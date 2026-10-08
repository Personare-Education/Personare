/**
 * Builds out/mcp/personare.mcpb, the extension Claude Desktop installs
 * (docs/specs/mcp-create-program.md AC-7): the server bundled into one file,
 * the manifest stamped with the app's version, and the app's icon.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const bundle = path.join(root, "out", "mcp", "bundle");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (args: string[]) =>
  execFileSync(npx, args, {
    cwd: root,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

run(["vite", "build", "--config", "vite.mcp.config.mts"]);

const { version } = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
// The $schema points into node_modules, which the bundle doesn't carry.
const { $schema: _schema, ...manifest } = JSON.parse(
  fs.readFileSync(path.join(root, "mcp", "manifest.json"), "utf8")
);
fs.writeFileSync(
  path.join(bundle, "manifest.json"),
  `${JSON.stringify({ ...manifest, version }, null, 2)}\n`
);
fs.copyFileSync(
  path.join(root, "assets", "icon.png"),
  path.join(bundle, "icon.png")
);

run(["mcpb", "validate", path.join(bundle, "manifest.json")]);
run(["mcpb", "pack", bundle, path.join(root, "out", "mcp", "personare.mcpb")]);
