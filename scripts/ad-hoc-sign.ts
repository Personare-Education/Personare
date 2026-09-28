import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

type Run = (command: string, args: string[]) => unknown;

function runSync(command: string, args: string[]) {
  execFileSync(command, args, { stdio: "inherit" });
}

/**
 * Re-signs each packaged Personare.app ad hoc, helpers and frameworks
 * included. Packaging edits the Electron helper apps inside the bundle,
 * which breaks their original ad hoc signatures, and Apple Silicon then
 * calls the downloaded app "damaged". Without a Developer ID, an ad hoc
 * signature over the whole bundle is what lets it open
 * (docs/specs/macos-build.md).
 */
export async function adHocSignMacApps(
  platform: string,
  outputPaths: string[],
  run: Run = runSync
) {
  if (platform !== "darwin") {
    return;
  }

  const listings = await Promise.all(
    outputPaths.map(async (outputPath) =>
      (await readdir(outputPath))
        .filter((name) => name.endsWith(".app"))
        .map((name) => path.join(outputPath, name))
    )
  );
  for (const appPath of listings.flat()) {
    run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  }
}
