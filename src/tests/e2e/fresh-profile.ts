import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * A `--user-data-dir` of its own for every run. Playwright starts the build
 * through the generic Electron binary, whose default profile
 * (%APPDATA%/Electron) every local run used to share: programs piled up
 * run after run until the Programs page got slow enough to time tests out.
 * CI never saw it, since it starts clean.
 */
export function freshProfileArg(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-e2e-"));
  return `--user-data-dir=${dir}`;
}
