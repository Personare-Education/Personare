import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * docs/specs/brand-primary.md AC-1, AC-2, AC-4: the primary is the brand
 * blue, and both its label and its use as text on the card stay at 4.5:1 or
 * more, in light and dark. Reads the real tokens from global.css.
 */

const CSS = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../styles/global.css"),
  "utf8"
);
const ROOT_BLOCK = /:root\s*\{([^}]*)\}/;
const DARK_BLOCK = /\.dark\s*\{([^}]*)\}/;
const HEX = /^#([0-9a-f]{6})$/i;
const ACHROMATIC_OKLCH = /^oklch\(([\d.]+) 0 0\)$/;

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

  for (const [theme, block] of Object.entries(THEMES)) {
    it(`keeps its label readable in ${theme}`, () => {
      expect(
        contrast(token(block, "primary"), token(block, "primary-foreground"))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`reads as text on the card in ${theme}`, () => {
      expect(
        contrast(token(block, "primary"), token(block, "card"))
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
