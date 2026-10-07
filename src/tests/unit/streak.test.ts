import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  computeBestStreak,
  computeCurrentStreak,
  msUntilNextLocalMidnight,
  streakIgnition,
  toActiveDateSet,
} from "@/utils/streak";

describe("toActiveDateSet (Issue #streak)", () => {
  it("builds a Set of the dates present in the rows", () => {
    const set = toActiveDateSet([
      { date: "2026-03-10" },
      { date: "2026-03-11" },
    ]);

    expect(set).toEqual(new Set(["2026-03-10", "2026-03-11"]));
  });

  it("returns an empty Set for no rows", () => {
    expect(toActiveDateSet([])).toEqual(new Set());
  });
});

describe("computeCurrentStreak (Issue #streak)", () => {
  const today = new Date("2026-03-15T10:00:00");

  it("counts consecutive days ending today when today is active", () => {
    const activeDates = new Set(["2026-03-13", "2026-03-14", "2026-03-15"]);

    expect(computeCurrentStreak(activeDates, today)).toBe(3);
  });

  it("counts through yesterday when today has no activity yet, without resetting to 0", () => {
    const activeDates = new Set(["2026-03-13", "2026-03-14"]);

    expect(computeCurrentStreak(activeDates, today)).toBe(2);
  });

  it("returns 0 when neither today nor yesterday is active", () => {
    const activeDates = new Set(["2026-03-01"]);

    expect(computeCurrentStreak(activeDates, today)).toBe(0);
  });

  it("stops counting at the first gap", () => {
    const activeDates = new Set(["2026-03-10", "2026-03-14", "2026-03-15"]);

    expect(computeCurrentStreak(activeDates, today)).toBe(2);
  });

  it("returns 0 for an empty history", () => {
    expect(computeCurrentStreak(new Set(), today)).toBe(0);
  });
});

describe("computeBestStreak (Issue #streak)", () => {
  it("returns 0 for an empty history", () => {
    expect(computeBestStreak(new Set())).toBe(0);
  });

  it("returns 1 for a single active day", () => {
    expect(computeBestStreak(new Set(["2026-03-10"]))).toBe(1);
  });

  it("finds the longest run among several separate runs", () => {
    const activeDates = new Set([
      "2026-01-01",
      "2026-01-02",
      "2026-02-10",
      "2026-02-11",
      "2026-02-12",
      "2026-02-13",
      "2026-03-01",
    ]);

    expect(computeBestStreak(activeDates)).toBe(4);
  });

  it("counts one continuous run correctly regardless of insertion order", () => {
    const activeDates = new Set([
      "2026-03-15",
      "2026-03-11",
      "2026-03-13",
      "2026-03-12",
      "2026-03-14",
    ]);

    expect(computeBestStreak(activeDates)).toBe(5);
  });
});

describe("msUntilNextLocalMidnight (Issue #streak)", () => {
  it("returns the exact remaining milliseconds until local midnight", () => {
    const now = new Date("2026-03-15T23:00:00");

    expect(msUntilNextLocalMidnight(now)).toBe(60 * 60 * 1000);
  });

  it("returns close to a full day just after midnight", () => {
    const now = new Date("2026-03-15T00:00:01");

    expect(msUntilNextLocalMidnight(now)).toBe(24 * 60 * 60 * 1000 - 1000);
  });
});

describe("buildMonthGrid (Issue #streak)", () => {
  const today = new Date("2026-03-15T10:00:00");

  it("covers every week (Sun-Sat) needed to show the whole month", () => {
    // March 2026: the 1st is a Sunday, the 31st is a Tuesday.
    const weeks = buildMonthGrid(
      new Date("2026-03-01T00:00:00"),
      new Set(),
      today
    );

    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
    const allDays = weeks.flat();
    expect(allDays[0].date.getDate()).toBe(1);
    expect(allDays[0].isOutsideMonth).toBe(false);
    expect(allDays.at(-1)?.isOutsideMonth).toBe(true);
  });

  it("marks the current day as isToday", () => {
    const weeks = buildMonthGrid(
      new Date("2026-03-01T00:00:00"),
      new Set(),
      today
    );

    const todayCell = weeks.flat().find((day) => day.dateKey === "2026-03-15");
    expect(todayCell?.isToday).toBe(true);
    const otherCell = weeks.flat().find((day) => day.dateKey === "2026-03-10");
    expect(otherCell?.isToday).toBe(false);
  });

  it("marks days present in activeDates as isActive", () => {
    const weeks = buildMonthGrid(
      new Date("2026-03-01T00:00:00"),
      new Set(["2026-03-10"]),
      today
    );

    const activeCell = weeks.flat().find((day) => day.dateKey === "2026-03-10");
    expect(activeCell?.isActive).toBe(true);
    const inactiveCell = weeks
      .flat()
      .find((day) => day.dateKey === "2026-03-11");
    expect(inactiveCell?.isActive).toBe(false);
  });

  describe("streakIgnition (gamification.md §1 AC-4)", () => {
    const now = new Date("2026-03-15T10:00:00");

    it("gives the new streak when a review lights today", () => {
      expect(
        streakIgnition(
          new Set(["2026-03-14"]),
          new Set(["2026-03-14", "2026-03-15"]),
          now
        )
      ).toBe(2);
    });

    it("gives null when today was already lit, or still is not", () => {
      expect(
        streakIgnition(new Set(["2026-03-15"]), new Set(["2026-03-15"]), now)
      ).toBeNull();
      expect(
        streakIgnition(new Set(["2026-03-14"]), new Set(["2026-03-14"]), now)
      ).toBeNull();
    });
  });
});
