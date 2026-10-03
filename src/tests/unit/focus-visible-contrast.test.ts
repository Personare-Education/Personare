import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * docs/specs/focus-rings.md AC-1, AC-2, AC-4: a focus ring is often the only
 * sign of keyboard focus, so it must reach 3:1. The translucent ones
 * (ring-ring/30 to /50, ring-destructive/20 or /40) stayed between ~1.4:1
 * and ~2:1. This scans the source so one cannot come back unnoticed.
 */

const SRC = path.resolve(import.meta.dirname, "../..");
const TRANSLUCENT_FOCUS_RING = /focus-visible:ring-(?:ring|destructive)\/\d+/g;
const SOURCE_FILE = /\.(tsx?|css)$/;
const SOLID_FOCUS_OUTLINE =
  /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ring\)/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "tests" ? [] : sourceFiles(full);
    }
    return SOURCE_FILE.test(entry.name) ? [full] : [];
  });
}

describe("focus rings", () => {
  it("are never translucent", () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      (fs.readFileSync(file, "utf8").match(TRANSLUCENT_FOCUS_RING) ?? []).map(
        (match) => `${path.relative(SRC, file)}: ${match}`
      )
    );

    expect(offenders).toEqual([]);
  });

  /** AC-3: what has no focus style of its own still shows one. */
  it("give every focusable element a solid outline by default", () => {
    const css = fs.readFileSync(path.join(SRC, "styles/global.css"), "utf8");

    expect(css).toMatch(SOLID_FOCUS_OUTLINE);
  });
});
