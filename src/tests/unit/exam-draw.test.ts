import { describe, expect, it } from "vitest";
import { drawExamQuestions } from "@/utils/exam-draw";

/**
 * RED phase (docs/specs/exams.md §1 AC-7): which questions an exam draws,
 * split evenly across its modules, with the standalone ones always in.
 */

function pool(moduleId: string, size: number) {
  return {
    moduleId,
    questionIds: Array.from({ length: size }, (_, i) => `${moduleId}-${i}`),
  };
}

/** A repeatable source of randomness, so the draws can be compared. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function countByModule(ids: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const [moduleId] = id.split("-");
    counts[moduleId] = (counts[moduleId] ?? 0) + 1;
  }
  return counts;
}

describe("drawExamQuestions (exams.md §1 AC-7)", () => {
  it("splits the total evenly across the modules", () => {
    const drawn = drawExamQuestions({
      pools: [pool("a", 10), pool("b", 10)],
      random: seeded(1),
      standaloneIds: [],
      total: 6,
    });

    expect(drawn).toHaveLength(6);
    expect(countByModule(drawn)).toEqual({ a: 3, b: 3 });
  });

  it("gives what the division leaves over to some of the modules", () => {
    const drawn = drawExamQuestions({
      pools: [pool("a", 10), pool("b", 10), pool("c", 10)],
      random: seeded(2),
      standaloneIds: [],
      total: 7,
    });

    const counts = Object.values(countByModule(drawn)).sort();
    expect(counts).toEqual([2, 2, 3]);
  });

  it("passes a short module's shortfall on to the others", () => {
    const drawn = drawExamQuestions({
      pools: [pool("a", 1), pool("b", 10)],
      random: seeded(3),
      standaloneIds: [],
      total: 6,
    });

    expect(countByModule(drawn)).toEqual({ a: 1, b: 5 });
  });

  it("takes every question when there are not enough", () => {
    const drawn = drawExamQuestions({
      pools: [pool("a", 2), pool("b", 3)],
      random: seeded(4),
      standaloneIds: [],
      total: 20,
    });

    expect([...drawn].sort()).toEqual(
      ["a-0", "a-1", "b-0", "b-1", "b-2"].sort()
    );
  });

  it("always adds the standalone questions, beyond the total", () => {
    const drawn = drawExamQuestions({
      pools: [pool("a", 10)],
      random: seeded(5),
      standaloneIds: ["s-0", "s-1"],
      total: 3,
    });

    expect(drawn).toHaveLength(5);
    expect(drawn).toEqual(expect.arrayContaining(["s-0", "s-1"]));
  });

  it("never repeats a question", () => {
    const drawn = drawExamQuestions({
      pools: [pool("a", 4), pool("b", 4)],
      random: seeded(6),
      standaloneIds: ["s-0"],
      total: 8,
    });

    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it("draws different questions from one attempt to the next", () => {
    const input = {
      pools: [pool("a", 30), pool("b", 30)],
      standaloneIds: [],
      total: 10,
    };

    const first = drawExamQuestions({ ...input, random: seeded(7) });
    const second = drawExamQuestions({ ...input, random: seeded(8) });

    expect(first).not.toEqual(second);
  });

  it("draws nothing but the standalone questions from empty modules", () => {
    expect(
      drawExamQuestions({
        pools: [pool("a", 0)],
        random: seeded(9),
        standaloneIds: ["s-0"],
        total: 5,
      })
    ).toEqual(["s-0"]);
  });
});
