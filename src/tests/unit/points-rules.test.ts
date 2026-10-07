import { describe, expect, it } from "vitest";
import {
  clampLoss,
  examPoints,
  overdueLoss,
  quizPoints,
  reviewPoints,
  streakBreakLoss,
  withStreak,
} from "@/utils/points";
import { RANK_STEPS, rankOf, seasonOf, seasonStartPoints } from "@/utils/ranks";

/**
 * RED phase (docs/specs/gamification.md §3 AC-1, §4 AC-1): the points
 * rules and the ladder, both pure.
 */

describe("points rules (gamification.md §3 AC-1)", () => {
  it("gives each rating its points, and 5 more when on time", () => {
    expect(reviewPoints("again", false)).toBe(4);
    expect(reviewPoints("hard", false)).toBe(8);
    expect(reviewPoints("good", false)).toBe(10);
    expect(reviewPoints("easy", false)).toBe(12);
    expect(reviewPoints("good", true)).toBe(15);
  });

  it("gives 3 per right quiz answer, and an exam 3 per right answer plus 30 for passing", () => {
    expect(quizPoints(4)).toBe(12);
    expect(examPoints(5, false)).toBe(15);
    expect(examPoints(5, true)).toBe(45);
  });

  it("adds 2% per streak day, up to 40%", () => {
    expect(withStreak(100, 0)).toBe(100);
    expect(withStreak(100, 5)).toBe(110);
    expect(withStreak(100, 20)).toBe(140);
    expect(withStreak(100, 60)).toBe(140);
    expect(withStreak(15, 3)).toBe(16);
  });

  it("takes 2 per newly overdue review, up to 30 a day", () => {
    expect(overdueLoss(3, 0)).toBe(-6);
    expect(overdueLoss(20, 0)).toBe(-30);
    expect(overdueLoss(10, 24)).toBe(-6);
    expect(overdueLoss(4, 30)).toBe(0);
  });

  it("takes 20 when a streak of 3 days or more breaks", () => {
    expect(streakBreakLoss(2)).toBe(0);
    expect(streakBreakLoss(3)).toBe(-20);
  });

  it("never takes the season below 0", () => {
    expect(clampLoss(-20, 50)).toBe(-20);
    expect(clampLoss(-20, 8)).toBe(-8);
    expect(clampLoss(-20, 0)).toBe(0);
  });
});

describe("the ladder (gamification.md §4 AC-1)", () => {
  it("has 7 tiers of 3 divisions and Magnum: 22 steps", () => {
    expect(RANK_STEPS).toHaveLength(22);
    expect(RANK_STEPS.at(-1)).toMatchObject({ division: null, tier: "magnum" });
    expect(RANK_STEPS.slice(0, 3).map((step) => step.division)).toEqual([
      3, 2, 1,
    ]);
  });

  it("places points on their step, with where it starts and ends", () => {
    expect(rankOf(0)).toMatchObject({
      division: 3,
      end: 100,
      start: 0,
      step: 1,
      tier: "iron",
    });
    expect(rankOf(299)).toMatchObject({ division: 1, step: 3, tier: "iron" });
    // Bronze III starts after Iron's 3 × 100.
    expect(rankOf(300)).toMatchObject({
      division: 3,
      start: 300,
      step: 4,
      tier: "bronze",
    });
    expect(rankOf(7049)).toMatchObject({ division: 1, tier: "diamond" });
    expect(rankOf(7050)).toMatchObject({
      division: null,
      end: null,
      start: 7050,
      step: 22,
      tier: "magnum",
    });
    expect(rankOf(99_999).step).toBe(22);
  });

  it("splits the year into quarters", () => {
    expect(seasonOf(new Date("2026-10-07T12:00:00"))).toMatchObject({
      id: "2026-Q4",
    });
    expect(seasonOf(new Date("2027-01-01T00:00:00")).id).toBe("2027-Q1");
    expect(seasonOf(new Date("2026-06-30T23:00:00")).id).toBe("2026-Q2");
  });

  it("starts a new season 6 steps below where the last one ended, at least Iron III", () => {
    // 1500 is Gold III (step 10) -> Bronze III (step 4).
    expect(rankOf(1500)).toMatchObject({ division: 3, step: 10, tier: "gold" });
    expect(seasonStartPoints(1500)).toBe(RANK_STEPS[3].start);
    expect(seasonStartPoints(250)).toBe(0);
    expect(seasonStartPoints(9000)).toBe(RANK_STEPS[15].start);
  });
});
