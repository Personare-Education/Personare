import { describe, expect, it } from "vitest";
import {
  getFocusedActivityIds,
  getReviewUrgency,
  summarizeReviewUrgency,
} from "@/utils/review-highlight";

/**
 * RED phase (docs/specs/calendar-module-review-highlight.md AC-5 to AC-7):
 * src/utils/review-highlight.ts does not exist yet. It classifies each
 * review_item by how urgent it is -- due today, or overdue (due before
 * today and not done yet) -- and rolls that up per Activity and per Module,
 * overdue winning over today.
 */

// Local time, mid-afternoon: "today" is 2026-03-10.
const NOW = new Date(2026, 2, 10, 15, 0);

describe("getReviewUrgency", () => {
  it("is 'today' for a review due any time today, even later than now", () => {
    expect(getReviewUrgency(new Date(2026, 2, 10, 0, 0), NOW)).toBe("today");
    expect(getReviewUrgency(new Date(2026, 2, 10, 23, 59), NOW)).toBe("today");
  });

  it("is 'overdue' for a review due before today", () => {
    expect(getReviewUrgency(new Date(2026, 2, 9, 23, 59), NOW)).toBe("overdue");
    expect(getReviewUrgency(new Date(2026, 1, 1), NOW)).toBe("overdue");
  });

  it("is null for a review due after today", () => {
    expect(getReviewUrgency(new Date(2026, 2, 11, 0, 0), NOW)).toBeNull();
  });
});

describe("summarizeReviewUrgency", () => {
  const rows = [
    // Module m1: a1 due today, a2 overdue.
    { activityId: "a1", dueDate: new Date(2026, 2, 10, 8), moduleId: "m1" },
    { activityId: "a2", dueDate: new Date(2026, 2, 8), moduleId: "m1" },
    // Module m2: a3 is a deck with one flashcard due today and one later.
    { activityId: "a3", dueDate: new Date(2026, 2, 20), moduleId: "m2" },
    { activityId: "a3", dueDate: new Date(2026, 2, 10, 9), moduleId: "m2" },
    // Module m3: nothing pending.
    { activityId: "a4", dueDate: new Date(2026, 2, 12), moduleId: "m3" },
  ];

  it("gives each pending activity its most urgent review", () => {
    expect(summarizeReviewUrgency(rows, NOW).byActivityId).toEqual({
      a1: "today",
      a2: "overdue",
      a3: "today",
    });
  });

  it("marks a module overdue when any of its activities is, else today", () => {
    expect(summarizeReviewUrgency(rows, NOW).byModuleId).toEqual({
      m1: "overdue",
      m2: "today",
    });
  });

  it("is empty when nothing is pending", () => {
    expect(summarizeReviewUrgency([], NOW)).toEqual({
      byActivityId: {},
      byModuleId: {},
    });
  });
});

describe("getFocusedActivityIds", () => {
  const rows = [
    { activityId: "a1", dueDate: new Date(2026, 2, 15, 10), moduleId: "m1" },
    { activityId: "a2", dueDate: new Date(2026, 2, 15, 22), moduleId: "m1" },
    { activityId: "a3", dueDate: new Date(2026, 2, 16), moduleId: "m1" },
    { activityId: "a4", dueDate: new Date(2026, 2, 15), moduleId: "m2" },
  ];

  it("lists the module's activities with a review on that local day", () => {
    expect(getFocusedActivityIds(rows, "m1", "2026-03-15")).toEqual(
      new Set(["a1", "a2"])
    );
  });

  it("is empty without a focus date", () => {
    expect(getFocusedActivityIds(rows, "m1", undefined)).toEqual(new Set());
  });
});
