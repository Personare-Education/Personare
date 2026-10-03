import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RED phase (docs/specs/typography-newsreader-instrument-sans.md). Every
 * family the theme asks for (--font-sans, --font-serif, --font-mono) must be
 * a family one of the imported @fontsource packages actually declares: the
 * app once asked for "Geist" while the package registers "Geist Variable",
 * so every screen silently fell back to Arial.
 */

const require = createRequire(import.meta.url);
const GLOBAL_CSS = readFileSync(
  path.resolve(process.cwd(), "src/styles/global.css"),
  "utf-8"
);
const IMPORT_PATTERN = /@import "(@fontsource-variable\/[^"]+)";/g;
const FAMILY_PATTERN = /font-family: '([^']+)'/g;
const THEME_FONT_PATTERN = /--font-(sans|serif|mono):\s*"([^"]+)"/g;

function declaredFamilies(): Set<string> {
  const families = new Set<string>();
  for (const [, specifier] of GLOBAL_CSS.matchAll(IMPORT_PATTERN)) {
    const file = specifier.endsWith(".css")
      ? require.resolve(specifier)
      : require.resolve(`${specifier}/index.css`);
    for (const [, family] of readFileSync(file, "utf-8").matchAll(
      FAMILY_PATTERN
    )) {
      families.add(family);
    }
  }
  return families;
}

function themeFonts(): Map<string, string> {
  return new Map(
    Array.from(GLOBAL_CSS.matchAll(THEME_FONT_PATTERN), ([, role, family]) => [
      role,
      family,
    ])
  );
}

describe("app typography", () => {
  it("uses Newsreader for reading, Instrument Sans for the interface and Geist Mono for code", () => {
    expect(Object.fromEntries(themeFonts())).toEqual({
      mono: "Geist Mono Variable",
      sans: "Instrument Sans Variable",
      serif: "Newsreader Variable",
    });
  });

  it("asks only for families that an imported font package declares", () => {
    const families = declaredFamilies();

    for (const family of themeFonts().values()) {
      expect(families).toContain(family);
    }
  });

  it("loads the italics too", () => {
    expect(GLOBAL_CSS).toContain(
      "@fontsource-variable/newsreader/opsz-italic.css"
    );
    expect(GLOBAL_CSS).toContain(
      "@fontsource-variable/instrument-sans/wght-italic.css"
    );
  });
});
