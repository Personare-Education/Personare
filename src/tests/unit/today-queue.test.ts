import { describe, expect, it } from "vitest";
import {
  buildTodayQueue,
  buildUpcoming,
  countDueByProgram,
  countReviewedOn,
  reviewedByProgramOn,
  type TodayRow,
} from "@/utils/today-queue";

/**
 * RED phase (docs/specs/today-review-queue.md AC-2, AC-3, AC-8): the pure
 * functions behind the "Today" screen -- what is due until the end of today,
 * grouped by program, overdue first, a deck as one item; and the next days'
 * preview.
 */

const NOW = new Date(2026, 9, 2, 9, 30); // Fri, Oct 2 2026, 09:30 local

function row(overrides: Partial<TodayRow>): TodayRow {
  return {
    activityFilePath: null,
    activityId: "a1",
    activityTitle: "Atividade",
    activityType: "pdf",
    activityUrl: null,
    dueDate: new Date(2026, 9, 2, 8, 0),
    front: null,
    id: "r1",
    moduleId: "m1",
    moduleName: "Derivadas",
    programColor: "#3b82f6",
    programId: "p1",
    programName: "Cálculo I",
    ...overrides,
  };
}

describe("buildTodayQueue", () => {
  it("keeps only what is due until the end of today", () => {
    const queue = buildTodayQueue(
      [
        row({
          activityId: "today",
          dueDate: new Date(2026, 9, 2, 23, 0),
          id: "1",
        }),
        row({
          activityId: "late",
          dueDate: new Date(2026, 8, 29, 10, 0),
          id: "2",
        }),
        row({
          activityId: "tomorrow",
          dueDate: new Date(2026, 9, 3, 0, 30),
          id: "3",
        }),
      ],
      NOW
    );

    expect(queue.items.map((item) => item.activityId).sort()).toEqual([
      "late",
      "today",
    ]);
    expect(queue.dueCount).toBe(2);
    expect(queue.overdueCount).toBe(1);
  });

  it("marks overdue items with how many days late, and puts them first", () => {
    const queue = buildTodayQueue(
      [
        row({ activityId: "today", activityTitle: "A", id: "1" }),
        row({
          activityId: "late",
          activityTitle: "B",
          dueDate: new Date(2026, 8, 29, 22, 0),
          id: "2",
        }),
      ],
      NOW
    );

    expect(queue.items[0]).toMatchObject({
      activityId: "late",
      overdueDays: 3,
      urgency: "overdue",
    });
    expect(queue.items[1]).toMatchObject({
      activityId: "today",
      overdueDays: 0,
      urgency: "today",
    });
  });

  it("rolls a deck's due flashcards up into one item with the card count", () => {
    const queue = buildTodayQueue(
      [
        row({
          activityId: "deck",
          activityType: "flashcard_deck",
          front: "a",
          id: "1",
        }),
        row({
          activityId: "deck",
          activityType: "flashcard_deck",
          front: "b",
          id: "2",
        }),
        row({
          activityId: "deck",
          activityType: "flashcard_deck",
          dueDate: new Date(2026, 8, 30),
          front: "c",
          id: "3",
        }),
      ],
      NOW
    );

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({
      activityId: "deck",
      cardCount: 3,
      urgency: "overdue",
    });
    // docs/specs/clarify-daily-count.md AC-1: the deck is one activity, its
    // due cards a detail.
    expect(queue.dueCount).toBe(1);
    expect(queue.dueCardCount).toBe(3);
    expect(queue.overdueCount).toBe(1);
  });

  it("groups by program, in the given program order", () => {
    const queue = buildTodayQueue(
      [
        row({
          activityId: "x",
          id: "1",
          programId: "p2",
          programName: "Anatomia",
        }),
        row({
          activityId: "y",
          id: "2",
          programId: "p1",
          programName: "Cálculo I",
        }),
        row({
          activityId: "z",
          id: "3",
          programId: "p2",
          programName: "Anatomia",
        }),
      ],
      NOW,
      ["p1", "p2"]
    );

    expect(queue.groups.map((group) => group.programId)).toEqual(["p1", "p2"]);
    expect(queue.groups[1].items.map((item) => item.activityId)).toEqual([
      "x",
      "z",
    ]);
    expect(queue.items.map((item) => item.activityId)).toEqual(["y", "x", "z"]);
  });

  it("is empty when nothing is due", () => {
    const queue = buildTodayQueue(
      [row({ dueDate: new Date(2026, 9, 5) })],
      NOW
    );

    expect(queue).toMatchObject({ dueCount: 0, groups: [], items: [] });
  });
});

describe("buildUpcoming", () => {
  it("counts the reviews due on each of the next 7 days and finds the next date", () => {
    const upcoming = buildUpcoming(
      [
        row({ dueDate: new Date(2026, 9, 2, 8, 0), id: "due-today" }),
        row({
          activityId: "b1",
          dueDate: new Date(2026, 9, 3, 10, 0),
          id: "1",
        }),
        row({
          activityId: "b2",
          dueDate: new Date(2026, 9, 3, 18, 0),
          id: "2",
        }),
        row({ dueDate: new Date(2026, 9, 6, 7, 0), id: "3" }),
        row({ dueDate: new Date(2026, 9, 20, 7, 0), id: "far" }),
      ],
      NOW
    );

    expect(upcoming.days).toHaveLength(7);
    expect(upcoming.days[0]).toEqual({ count: 2, date: new Date(2026, 9, 3) });
    expect(upcoming.days[3]).toEqual({ count: 1, date: new Date(2026, 9, 6) });
    expect(upcoming.days.reduce((sum, day) => sum + day.count, 0)).toBe(3);
    expect(upcoming.nextDate).toEqual(new Date(2026, 9, 3));
  });

  /** docs/specs/clarify-daily-count.md AC-6 */
  it("counts a deck once on a day, however many of its cards come back", () => {
    const upcoming = buildUpcoming(
      [
        row({ activityId: "deck", dueDate: new Date(2026, 9, 3, 9), id: "c1" }),
        row({
          activityId: "deck",
          dueDate: new Date(2026, 9, 3, 11),
          id: "c2",
        }),
        row({
          activityId: "deck",
          dueDate: new Date(2026, 9, 3, 15),
          id: "c3",
        }),
      ],
      NOW
    );

    expect(upcoming.days[0].count).toBe(1);
  });

  it("finds the next date even beyond the week", () => {
    const upcoming = buildUpcoming(
      [row({ dueDate: new Date(2026, 9, 20, 7, 0) })],
      NOW
    );

    expect(upcoming.nextDate).toEqual(new Date(2026, 9, 20));
  });

  it("has no next date when nothing is scheduled ahead", () => {
    expect(buildUpcoming([], NOW).nextDate).toBeNull();
  });
});

describe("countDueByProgram", () => {
  it("counts each program's activities due until the end of today", () => {
    const counts = countDueByProgram(
      [
        row({ activityId: "a1", id: "1", programId: "p1" }),
        row({
          activityId: "a2",
          dueDate: new Date(2026, 8, 30),
          id: "2",
          programId: "p1",
        }),
        // A second due card of the same deck is the same activity.
        row({
          activityId: "a2",
          activityType: "flashcard_deck",
          id: "2b",
          programId: "p1",
        }),
        row({ id: "3", programId: "p2" }),
        row({ dueDate: new Date(2026, 9, 9), id: "4", programId: "p2" }),
      ],
      NOW
    );

    expect(counts.get("p1")).toBe(2);
    expect(counts.get("p2")).toBe(1);
  });
});

describe("countReviewedOn", () => {
  it("sums the activities reviewed on the given local day across programs", () => {
    // docs/specs/clarify-daily-count.md AC-4: `count` is every rating (the
    // heatmap's), `activities` each activity once.
    const counts = [
      { activities: 1, count: 3, date: "2026-10-02", programId: "p1" },
      { activities: 2, count: 2, date: "2026-10-02", programId: "p2" },
      { activities: 4, count: 9, date: "2026-10-01", programId: "p1" },
    ];

    expect(countReviewedOn(counts, NOW)).toBe(3);
  });
});

/** docs/specs/delight-day-done.md AC-3 */
describe("buildUpcoming nextCount", () => {
  it("counts the activities that come back on the next date", () => {
    const upcoming = buildUpcoming(
      [
        row({ activityId: "a", dueDate: new Date(2026, 9, 11, 9), id: "1" }),
        row({ activityId: "a", dueDate: new Date(2026, 9, 11, 10), id: "2" }),
        row({ activityId: "b", dueDate: new Date(2026, 9, 11, 18), id: "3" }),
        row({ activityId: "c", dueDate: new Date(2026, 9, 12, 9), id: "4" }),
      ],
      NOW
    );

    expect(upcoming.nextDate).toEqual(new Date(2026, 9, 11));
    expect(upcoming.nextCount).toBe(2);
  });
});

/** docs/specs/delight-day-done.md AC-2 */
describe("reviewedByProgramOn", () => {
  it("lists the programs reviewed on the day, in program order, with their colors", () => {
    const programs = [
      { color: "#22c55e", id: "p2", name: "Anatomia" },
      { color: null, id: "p1", name: "Cálculo I" },
      { color: "#ec4899", id: "p3", name: "Química" },
    ];
    const counts = [
      { activities: 2, count: 5, date: "2026-10-02", programId: "p1" },
      { activities: 1, count: 1, date: "2026-10-02", programId: "p2" },
      { activities: 4, count: 4, date: "2026-10-01", programId: "p3" },
    ];

    expect(reviewedByProgramOn(counts, programs, NOW)).toEqual([
      {
        activities: 1,
        color: "#22c55e",
        programId: "p2",
        programName: "Anatomia",
      },
      { activities: 2, color: null, programId: "p1", programName: "Cálculo I" },
    ]);
  });
});
