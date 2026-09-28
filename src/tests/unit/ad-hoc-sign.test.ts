import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adHocSignMacApps } from "../../../scripts/ad-hoc-sign";

/*
 * Spec: docs/specs/macos-build.md -- packaging edits the Electron helper
 * apps inside Personare.app, breaking their ad hoc signatures, and Apple
 * Silicon then calls the downloaded app "damaged". The whole bundle,
 * helpers included, is re-signed ad hoc once packaging is done.
 */

let outputPath: string;

beforeEach(async () => {
  outputPath = await mkdtemp(path.join(tmpdir(), "ad-hoc-sign-"));
  await mkdir(path.join(outputPath, "Personare.app", "Contents"), {
    recursive: true,
  });
});

afterEach(async () => {
  await rm(outputPath, { force: true, recursive: true });
});

describe("adHocSignMacApps", () => {
  it("signs every .app in the output, deeply, with the ad hoc identity", async () => {
    const sign = vi.fn();

    await adHocSignMacApps("darwin", [outputPath], sign);

    expect(sign).toHaveBeenCalledWith("codesign", [
      "--force",
      "--deep",
      "--sign",
      "-",
      path.join(outputPath, "Personare.app"),
    ]);
  });

  it("does nothing outside macOS", async () => {
    const sign = vi.fn();

    await adHocSignMacApps("win32", [outputPath], sign);

    expect(sign).not.toHaveBeenCalled();
  });
});
