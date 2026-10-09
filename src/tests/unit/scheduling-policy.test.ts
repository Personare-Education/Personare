import { describe, expect, it } from "vitest";
import {
  daysUntilTest,
  isPreparingForTest,
  scheduleForGoal,
} from "@/utils/scheduling-policy";

/** docs/architecture/scheduling.md D2, D7; docs/specs/test-prep-scheduling.md. */

const NOW = new Date(2026, 9, 9, 15, 0); // 2026-10-09 15:00, local
const TEST = { studyGoal: "test_prep" as const, targetDate: "2026-10-20" };
const RETAIN = { studyGoal: "retain" as const, targetDate: null };
const EVE = new Date(2026, 9, 19, 0, 0); // the start of the day before

describe("scheduleForGoal (D7)", () => {
  it("keeps the FSRS due date for 'Nunca mais esquecer'", () => {
    const due = new Date(2026, 11, 1);
    expect(scheduleForGoal(due, RETAIN, NOW)).toEqual(due);
  });

  it("keeps it when the program can't be found", () => {
    const due = new Date(2026, 11, 1);
    expect(scheduleForGoal(due, null, NOW)).toEqual(due);
  });

  it("brings a due date after the test back to its eve", () => {
    expect(scheduleForGoal(new Date(2026, 11, 1), TEST, NOW)).toEqual(EVE);
    expect(scheduleForGoal(new Date(2026, 9, 20, 9), TEST, NOW)).toEqual(EVE);
  });

  it("keeps a due date already before the eve", () => {
    const due = new Date(2026, 9, 12);
    expect(scheduleForGoal(due, TEST, NOW)).toEqual(due);
    const inMinutes = new Date(2026, 9, 9, 15, 10);
    expect(scheduleForGoal(inMinutes, TEST, NOW)).toEqual(inMinutes);
  });

  it("keeps the FSRS due date when the eve has passed (test today or tomorrow)", () => {
    const due = new Date(2026, 11, 1);
    const tomorrow = { ...TEST, targetDate: "2026-10-10" };
    const today = { ...TEST, targetDate: "2026-10-09" };
    expect(scheduleForGoal(due, tomorrow, NOW)).toEqual(due);
    expect(scheduleForGoal(due, today, NOW)).toEqual(due);
  });

  it("acts as 'Nunca mais esquecer' once the test has passed (D2)", () => {
    const due = new Date(2026, 11, 1);
    const past = { ...TEST, targetDate: "2026-10-01" };
    expect(scheduleForGoal(due, past, NOW)).toEqual(due);
  });
});

describe("isPreparingForTest (D2)", () => {
  it("is true up to and including the test's day", () => {
    expect(isPreparingForTest(TEST, NOW)).toBe(true);
    expect(isPreparingForTest({ ...TEST, targetDate: "2026-10-09" }, NOW)).toBe(
      true
    );
    expect(isPreparingForTest({ ...TEST, targetDate: "2026-10-08" }, NOW)).toBe(
      false
    );
    expect(isPreparingForTest(RETAIN, NOW)).toBe(false);
  });
});

describe("daysUntilTest", () => {
  it("counts calendar days", () => {
    expect(daysUntilTest("2026-10-20", NOW)).toBe(11);
    expect(daysUntilTest("2026-10-10", NOW)).toBe(1);
    expect(daysUntilTest("2026-10-09", NOW)).toBe(0);
    expect(daysUntilTest("2026-10-01", NOW)).toBe(-8);
  });
});
