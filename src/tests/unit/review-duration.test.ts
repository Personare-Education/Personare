import { describe, expect, it } from "vitest";
import { reviewDuration } from "@/components/flashcard-review-panel";

/** docs/specs/review-logs.md AC-3. */

describe("reviewDuration", () => {
  it("is the time from the card shown to the rating", () => {
    expect(reviewDuration(1000, 5200)).toBe(4200);
  });

  it("is not measured past 15 minutes: the student likely left", () => {
    expect(reviewDuration(0, 15 * 60 * 1000)).toBe(15 * 60 * 1000);
    expect(reviewDuration(0, 15 * 60 * 1000 + 1)).toBeUndefined();
  });

  it("is not measured if the clock went backwards", () => {
    expect(reviewDuration(5000, 1000)).toBeUndefined();
  });
});
