import { describe, expect, it } from "vitest";
import {
  computeRetention,
  RETENTION_WINDOW_DAYS,
} from "@/utils/retention-stats";

/** docs/specs/retention-summary.md AC-1. */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = new Date("2026-10-09T12:00:00Z").getTime();

function history(...entries: [rating: string, msAgo: number][]) {
  return JSON.stringify(
    entries.map(([rating, msAgo]) => ({ rating, reviewedAt: NOW - msAgo }))
  );
}

describe("computeRetention", () => {
  it("looks at the last 30 days", () => {
    expect(RETENTION_WINDOW_DAYS).toBe(30);
  });

  it("counts a later review as remembered unless it was 'again'", () => {
    const result = computeRetention(
      [
        history(["good", 20 * DAY], ["good", 10 * DAY], ["again", 2 * DAY]),
        history(["easy", 9 * DAY], ["hard", 1 * DAY]),
      ],
      new Date(NOW)
    );

    expect(result).toEqual({ attempts: 3, remembered: 2 });
  });

  it("skips an item's first rating: there was nothing to remember yet", () => {
    const result = computeRetention(
      [history(["again", 3 * DAY])],
      new Date(NOW)
    );

    expect(result).toEqual({ attempts: 0, remembered: 0 });
  });

  it("skips ratings in the same sitting as the one before", () => {
    const result = computeRetention(
      [
        history(
          ["good", 5 * DAY],
          ["again", 1 * DAY],
          ["good", 1 * DAY - 10 * 60_000]
        ),
      ],
      new Date(NOW)
    );

    expect(result).toEqual({ attempts: 1, remembered: 0 });
  });

  it("leaves out reviews older than the window", () => {
    const result = computeRetention(
      [history(["good", 60 * DAY], ["good", 40 * DAY], ["good", 12 * HOUR])],
      new Date(NOW)
    );

    expect(result).toEqual({ attempts: 1, remembered: 1 });
  });

  it("ignores a history it can't read", () => {
    expect(computeRetention(["not json", "[]"], new Date(NOW))).toEqual({
      attempts: 0,
      remembered: 0,
    });
  });
});
