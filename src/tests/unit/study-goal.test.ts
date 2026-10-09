import { describe, expect, it } from "vitest";
import { DEFAULT_STUDY_GOAL, isDayKey, parseDayKey } from "@/utils/study-goal";

/** docs/specs/program-study-goal.md AC-1. */

describe("study goal", () => {
  it("defaults to 'Nunca mais esquecer'", () => {
    expect(DEFAULT_STUDY_GOAL).toBe("retain");
  });

  it("reads a test day as local midnight", () => {
    const date = parseDayKey("2026-11-20");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(20);
    expect(date?.getHours()).toBe(0);
  });

  it.each(["2026-02-31", "20-11-2026", "2026-11-20T10:00", ""])(
    "rejects %s",
    (value) => {
      expect(isDayKey(value)).toBe(false);
    }
  );
});
