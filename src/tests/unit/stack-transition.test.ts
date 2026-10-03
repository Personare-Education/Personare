import { describe, expect, it } from "vitest";
import { getStackTransitionTypes } from "@/utils/stack-transition";

/**
 * RED phase (docs/specs/calendar-module-review-highlight.md AC-9 to AC-11):
 * src/utils/stack-transition.ts does not exist yet. It picks the view
 * transition type for a navigation, like React Navigation's stack: going a
 * level deeper (Programs -> Program -> Module) is a push, going back up is
 * a pop, anything else does not animate.
 */

// Programs moved to /programs when Today became the opening screen
// (docs/specs/today-review-queue.md AC-1).
const PROGRAMS = "/programs";
const PROGRAM = "/programs/p1";
const MODULE = "/programs/p1/modules/m1";

describe("getStackTransitionTypes", () => {
  it("pushes when going a level deeper", () => {
    expect(getStackTransitionTypes(PROGRAMS, PROGRAM)).toEqual(["stack-push"]);
    expect(getStackTransitionTypes(PROGRAM, MODULE)).toEqual(["stack-push"]);
    expect(getStackTransitionTypes(`${PROGRAM}/`, MODULE)).toEqual([
      "stack-push",
    ]);
  });

  it("pops when going back up", () => {
    expect(getStackTransitionTypes(MODULE, PROGRAM)).toEqual(["stack-pop"]);
    expect(getStackTransitionTypes(PROGRAM, PROGRAMS)).toEqual(["stack-pop"]);
  });

  it("does not animate jumps between Today and the programs stack", () => {
    expect(getStackTransitionTypes("/", PROGRAMS)).toBe(false);
    expect(getStackTransitionTypes(PROGRAMS, "/")).toBe(false);
    expect(getStackTransitionTypes(`${PROGRAMS}/`, PROGRAM)).toEqual([
      "stack-push",
    ]);
  });

  it("pushes from the calendar into a program", () => {
    expect(getStackTransitionTypes("/calendar", PROGRAM)).toEqual([
      "stack-push",
    ]);
  });

  it("does not animate outside the programs stack or on the same level", () => {
    expect(getStackTransitionTypes(PROGRAMS, "/calendar")).toBe(false);
    expect(getStackTransitionTypes("/calendar", "/settings")).toBe(false);
    expect(getStackTransitionTypes(MODULE, "/calendar")).toBe(false);
    expect(getStackTransitionTypes(MODULE, MODULE)).toBe(false);
    expect(getStackTransitionTypes(undefined, PROGRAMS)).toBe(false);
  });
});
