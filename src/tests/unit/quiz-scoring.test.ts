import { describe, expect, it } from "vitest";
import {
  calculateQuizScore,
  formatQuizDuration,
  type QuizScoringQuestion,
  suggestQuizRating,
} from "@/utils/quiz-scoring";

/**
 * RED phase (Issue #14, Spec Driven TDD): src/utils/quiz-scoring.ts does not
 * exist yet. Every test below is expected to fail until Fundacao (Developer)
 * implements calculateQuizScore.
 *
 * Contract exercised here (criterio de aceite 4 and 6): the result screen
 * shows how many questions the user got right out of how many, computed
 * purely in memory from the selected option per question -- nothing is
 * persisted to the database in this V1 (Plan.md 1.2), so the function under
 * test takes the full in-memory quiz state and returns a score, without any
 * database or IPC dependency.
 */

const QUESTIONS: QuizScoringQuestion[] = [
  {
    id: "q1",
    options: [
      { id: "q1-a", isCorrect: true },
      { id: "q1-b", isCorrect: false },
    ],
  },
  {
    id: "q2",
    options: [
      { id: "q2-a", isCorrect: false },
      { id: "q2-b", isCorrect: true },
      { id: "q2-c", isCorrect: false },
    ],
  },
  {
    id: "q3",
    options: [
      { id: "q3-a", isCorrect: false },
      { id: "q3-b", isCorrect: true },
    ],
  },
];

describe("calculateQuizScore (Issue #14)", () => {
  it("counts a fully correct run as total correct out of total", () => {
    const answers = { q1: "q1-a", q2: "q2-b", q3: "q3-b" };

    expect(calculateQuizScore(QUESTIONS, answers)).toEqual({
      correct: 3,
      total: 3,
    });
  });

  it("counts only the questions whose chosen option isCorrect as correct", () => {
    const answers = { q1: "q1-a", q2: "q2-a", q3: "q3-a" };

    expect(calculateQuizScore(QUESTIONS, answers)).toEqual({
      correct: 1,
      total: 3,
    });
  });

  it("counts an unanswered question as incorrect, without throwing", () => {
    const answers = { q1: "q1-a" };

    expect(calculateQuizScore(QUESTIONS, answers)).toEqual({
      correct: 1,
      total: 3,
    });
  });

  it("returns zero correct out of zero for a quiz with no questions", () => {
    expect(calculateQuizScore([], {})).toEqual({ correct: 0, total: 0 });
  });

  it("ignores an answer whose optionId does not belong to that question", () => {
    const answers = { q1: "q2-b" };

    expect(calculateQuizScore(QUESTIONS, answers)).toEqual({
      correct: 0,
      total: 3,
    });
  });
});

/**
 * RED phase (Issue #93, Spec Driven TDD): formatQuizDuration does not exist
 * yet, per docs/specs/issue-93-quiz-multistep-radial-results.md AC-1.
 */
describe("formatQuizDuration (Issue #93)", () => {
  it("formats a sub-minute duration as seconds only", () => {
    expect(formatQuizDuration(45_000)).toBe("45s");
  });

  it("formats a duration of a minute or more as minutes and zero-padded seconds", () => {
    expect(formatQuizDuration(185_000)).toBe("3m 05s");
  });

  it("rounds to the nearest second", () => {
    expect(formatQuizDuration(1499)).toBe("1s");
    expect(formatQuizDuration(1500)).toBe("2s");
  });

  it("treats a negative duration as zero", () => {
    expect(formatQuizDuration(-1000)).toBe("0s");
  });

  /** docs/specs/rating-clarity.md AC-4: a real but very short time is not "0s". */
  it("formats a positive duration under half a second as <1s", () => {
    expect(formatQuizDuration(300)).toBe("<1s");
  });

  it("formats exactly zero as 0s", () => {
    expect(formatQuizDuration(0)).toBe("0s");
  });
});

describe("suggestQuizRating (docs/specs/quiz-result-rating.md AC-2)", () => {
  it.each([
    [0, 2, "again"],
    [1, 3, "again"],
    [1, 2, "hard"],
    [3, 4, "hard"],
    [4, 5, "good"],
    [9, 10, "good"],
    [2, 2, "easy"],
  ] as const)("%i of %i right suggests %s", (correct, total, rating) => {
    expect(suggestQuizRating({ correct, total })).toBe(rating);
  });

  it("suggests nothing harsh for an empty quiz", () => {
    expect(suggestQuizRating({ correct: 0, total: 0 })).toBe("good");
  });
});
