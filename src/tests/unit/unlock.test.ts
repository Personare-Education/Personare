import { describe, expect, it } from "vitest";
import {
  computeLocks,
  type LockActivity,
  type LockModule,
  type LockRequirement,
} from "@/utils/unlock";

/**
 * RED phase (docs/specs/sequences-and-locks.md §2 AC-1..4): which modules
 * and activities are locked, and what each still needs.
 */

const DONE = new Date("2026-10-01T12:00:00Z");

function module(overrides: Partial<LockModule> & { id: string }): LockModule {
  return { position: 0, programId: "p", unlockMode: "none", ...overrides };
}

function activity(
  overrides: Partial<LockActivity> & { id: string }
): LockActivity {
  return {
    completedAt: null,
    moduleId: "m1",
    parentActivityId: null,
    position: 0,
    unlockMode: "none",
    ...overrides,
  };
}

function requirement(
  subjectId: string,
  requiredId: string,
  subjectKind: "activity" | "module" = "activity"
): LockRequirement {
  return { requiredId, subjectId, subjectKind };
}

describe("computeLocks", () => {
  it("leaves everything free by default", () => {
    const locks = computeLocks({
      activities: [activity({ id: "a" })],
      modules: [module({ id: "m1" })],
      requirements: [],
    });

    expect(locks.activities.a).toBeUndefined();
    expect(locks.modules.m1).toBeUndefined();
  });

  describe("activities (AC-3)", () => {
    const pdf = activity({ id: "pdf", position: 0 });
    const video = activity({ id: "video", position: 1 });

    it("locks one until all the previous ones are done", () => {
      const quiz = activity({
        id: "quiz",
        position: 2,
        unlockMode: "previous",
      });

      const locks = computeLocks({
        activities: [quiz, video, { ...pdf, completedAt: DONE }],
        modules: [module({ id: "m1" })],
        requirements: [],
      });

      expect(locks.activities.quiz).toEqual({
        locked: true,
        missing: [{ id: "video", kind: "activity" }],
      });

      const unlocked = computeLocks({
        activities: [
          quiz,
          { ...video, completedAt: DONE },
          { ...pdf, completedAt: DONE },
        ],
        modules: [module({ id: "m1" })],
        requirements: [],
      });
      expect(unlocked.activities.quiz).toBeUndefined();
    });

    it("unlocks an 'any' rule with one of its list done", () => {
      const quiz = activity({ id: "quiz", position: 2, unlockMode: "any" });
      const requirements = [
        requirement("quiz", "pdf"),
        requirement("quiz", "video"),
      ];

      expect(
        computeLocks({
          activities: [pdf, video, quiz],
          modules: [module({ id: "m1" })],
          requirements,
        }).activities.quiz?.missing
      ).toEqual([
        { id: "pdf", kind: "activity" },
        { id: "video", kind: "activity" },
      ]);
      expect(
        computeLocks({
          activities: [pdf, { ...video, completedAt: DONE }, quiz],
          modules: [module({ id: "m1" })],
          requirements,
        }).activities.quiz
      ).toBeUndefined();
    });

    it("keeps an 'all' rule locked until its whole list is done", () => {
      const quiz = activity({ id: "quiz", position: 2, unlockMode: "all" });
      const requirements = [
        requirement("quiz", "pdf"),
        requirement("quiz", "video"),
      ];

      expect(
        computeLocks({
          activities: [{ ...pdf, completedAt: DONE }, video, quiz],
          modules: [module({ id: "m1" })],
          requirements,
        }).activities.quiz
      ).toEqual({ locked: true, missing: [{ id: "video", kind: "activity" }] });
    });

    it("looks for 'previous' inside the group, for a sub-activity", () => {
      const group = activity({ id: "group", position: 5 });
      const first = activity({
        id: "first",
        parentActivityId: "group",
        position: 0,
      });
      const second = activity({
        id: "second",
        parentActivityId: "group",
        position: 1,
        unlockMode: "previous",
      });

      // "pdf" sits before the group in the module but is not a sibling.
      const locks = computeLocks({
        activities: [pdf, group, first, second],
        modules: [module({ id: "m1" })],
        requirements: [],
      });

      expect(locks.activities.second?.missing).toEqual([
        { id: "first", kind: "activity" },
      ]);
    });

    it("locks a sub-activity while its group is locked", () => {
      const group = activity({
        id: "group",
        position: 1,
        unlockMode: "previous",
      });
      const inside = activity({ id: "inside", parentActivityId: "group" });

      const locks = computeLocks({
        activities: [pdf, group, inside],
        modules: [module({ id: "m1" })],
        requirements: [],
      });

      expect(locks.activities.inside).toEqual({
        locked: true,
        missing: [{ id: "group", kind: "activity" }],
        waiting: true,
      });
    });
  });

  describe("modules (AC-2)", () => {
    it("locks a module until the previous modules are done", () => {
      const locks = computeLocks({
        activities: [
          activity({ completedAt: DONE, id: "a", moduleId: "m1" }),
          activity({ id: "b", moduleId: "m1", position: 1 }),
          activity({ id: "c", moduleId: "m2" }),
        ],
        modules: [
          module({ id: "m1", position: 0 }),
          module({ id: "m2", position: 1, unlockMode: "previous" }),
        ],
        requirements: [],
      });

      expect(locks.modules.m2).toEqual({
        locked: true,
        missing: [{ id: "m1", kind: "module" }],
      });
      // Its activities are locked with it (AC-3).
      expect(locks.activities.c).toEqual({
        locked: true,
        missing: [{ id: "m2", kind: "module" }],
        waiting: true,
      });
    });

    it("does not count an empty module as done", () => {
      const locks = computeLocks({
        activities: [],
        modules: [
          module({ id: "m1", position: 0 }),
          module({ id: "m2", position: 1, unlockMode: "all" }),
        ],
        requirements: [requirement("m2", "m1", "module")],
      });

      expect(locks.modules.m2?.locked).toBe(true);
    });

    it("only compares modules of the same program", () => {
      const locks = computeLocks({
        activities: [],
        modules: [
          module({ id: "other", position: 0, programId: "q" }),
          module({ id: "m1", position: 1, unlockMode: "previous" }),
        ],
        requirements: [],
      });

      expect(locks.modules.m1).toBeUndefined();
    });
  });

  describe("deleted requirements (AC-4)", () => {
    it("ignores a list item that no longer exists, and an empty list does not lock", () => {
      const locks = computeLocks({
        activities: [activity({ id: "quiz", unlockMode: "all" })],
        modules: [module({ id: "m1" })],
        requirements: [requirement("quiz", "gone")],
      });

      expect(locks.activities.quiz).toBeUndefined();
    });
  });
});
