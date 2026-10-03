import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROGRAM_COLOR,
  DEFAULT_PROGRAM_ICON_NAME,
  PROGRAM_COLORS,
  PROGRAM_ICONS,
  resolveProgramColor,
  resolveProgramIcon,
} from "@/constants/program-appearance";

describe("program-appearance (Issue #99 revision)", () => {
  it("resolves a known icon name to its component", () => {
    const match = PROGRAM_ICONS.find((entry) => entry.name === "Brain");
    expect(resolveProgramIcon("Brain")).toBe(match?.Icon);
  });

  it("falls back to the default icon for null", () => {
    const defaultEntry = PROGRAM_ICONS.find(
      (entry) => entry.name === DEFAULT_PROGRAM_ICON_NAME
    );
    expect(resolveProgramIcon(null)).toBe(defaultEntry?.Icon);
  });

  it("falls back to the default icon for an unknown name", () => {
    const defaultEntry = PROGRAM_ICONS.find(
      (entry) => entry.name === DEFAULT_PROGRAM_ICON_NAME
    );
    expect(resolveProgramIcon("NotARealIcon")).toBe(defaultEntry?.Icon);
  });

  it("resolves a given color as-is", () => {
    expect(resolveProgramColor("#123456")).toBe("#123456");
  });

  it("falls back to the default color for null", () => {
    expect(resolveProgramColor(null)).toBe(DEFAULT_PROGRAM_COLOR);
  });

  it("has a default color that is part of the palette", () => {
    expect(PROGRAM_COLORS).toContain(DEFAULT_PROGRAM_COLOR);
  });

  /** docs/specs/bolder-cards.md AC-1 */
  it("starts programs in the brand blue, not red", () => {
    expect(DEFAULT_PROGRAM_COLOR).toBe("#3b6cf6");
    expect(resolveProgramColor(null)).toBe("#3b6cf6");
  });
});
