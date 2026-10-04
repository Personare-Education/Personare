import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * docs/specs/brand-primary.md AC-1, AC-4 and docs/specs/dark-primary.md: the
 * primary is the brand blue in both themes, its label stays at 4.5:1 or
 * more, and the button stands out from the page. Blue text uses
 * --brand-text, not the primary. Reads the real tokens from global.css.
 */

const CSS = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../styles/global.css"),
  "utf8"
);
const ROOT_BLOCK = /:root\s*\{([^}]*)\}/;
const DARK_BLOCK = /\.dark\s*\{([^}]*)\}/;
const HEX = /^#([0-9a-f]{6})$/i;
const ACHROMATIC_OKLCH = /^oklch\(([\d.]+) 0 0\)$/;
const TEXT_PRIMARY = /\btext-primary(?![-\w])/g;
const SRC = path.resolve(import.meta.dirname, "../..");
const SOURCE_FILE = /\.tsx?$/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "tests" ? [] : sourceFiles(full);
    }
    return SOURCE_FILE.test(entry.name) ? [full] : [];
  });
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`--${name} not found`);
  }
  return match[1].trim();
}

/** WCAG relative luminance of a hex color or an achromatic oklch(). */
function luminance(color: string): number {
  const hex = color.match(HEX);
  if (hex) {
    const channel = (offset: number) => {
      const c = Number.parseInt(hex[1].slice(offset, offset + 2), 16) / 255;
      return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  }
  const oklch = color.match(ACHROMATIC_OKLCH);
  if (oklch) {
    // With no chroma, OKLab lightness cubed is the relative luminance.
    return Number(oklch[1]) ** 3;
  }
  throw new Error(`cannot read ${color}`);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = {
  dark: (CSS.match(DARK_BLOCK) as RegExpMatchArray)[1],
  light: (CSS.match(ROOT_BLOCK) as RegExpMatchArray)[1],
};

describe("primary", () => {
  it("is the brand blue in light, a darker shade for a white label", () => {
    expect(token(THEMES.light, "primary").toLowerCase()).toBe("#2f5ce0");
  });

  /** docs/specs/dark-primary.md AC-1 */
  it("is the same blue with a white label in dark, not a pale one", () => {
    expect(token(THEMES.dark, "primary").toLowerCase()).toBe("#2f5ce0");
    expect(token(THEMES.dark, "primary-foreground").toLowerCase()).toBe(
      "#ffffff"
    );
  });

  /** docs/specs/dark-primary.md AC-3 */
  it("is never used for text: blue text is --brand-text", () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      (fs.readFileSync(file, "utf8").match(TEXT_PRIMARY) ?? []).map(
        (match) => `${path.relative(SRC, file)}: ${match}`
      )
    );
    expect(offenders).toEqual([]);
  });

  for (const [theme, block] of Object.entries(THEMES)) {
    it(`keeps its label readable in ${theme}`, () => {
      expect(
        contrast(token(block, "primary"), token(block, "primary-foreground"))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`stands out from the page in ${theme}`, () => {
      expect(
        contrast(token(block, "primary"), token(block, "background"))
      ).toBeGreaterThanOrEqual(3);
    });
  }
});
