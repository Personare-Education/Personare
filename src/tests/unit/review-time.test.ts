import i18n from "i18next";
import { describe, expect, it } from "vitest";
import "@/localization/i18n";
import { previewRatings } from "@/utils/fsrs";
import { formatInterval, formatRelativeDue } from "@/utils/review-time";

/**
 * RED phase (docs/specs/rating-clarity.md AC-1, AC-3): what each rating
 * would schedule, and how a due date reads in the table.
 */

const NOW = new Date(2026, 9, 2, 9, 30);
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

describe("previewRatings", () => {
  it("previews the four ratings for an activity never rated, in whole days", () => {
    const preview = previewRatings(null, NOW, { shortTermEnabled: false });

    expect(Object.keys(preview).sort()).toEqual([
      "again",
      "easy",
      "good",
      "hard",
    ]);
    for (const due of Object.values(preview)) {
      expect(due.getTime() - NOW.getTime()).toBeGreaterThanOrEqual(DAY);
    }
    expect(preview.again.getTime()).toBeLessThanOrEqual(preview.hard.getTime());
    expect(preview.hard.getTime()).toBeLessThanOrEqual(preview.good.getTime());
    expect(preview.good.getTime()).toBeLessThanOrEqual(preview.easy.getTime());
    expect(preview.easy.getTime()).toBeGreaterThan(preview.again.getTime());
  });

  it("keeps a new flashcard's short learning steps", () => {
    const preview = previewRatings(null, NOW);

    expect(preview.again.getTime() - NOW.getTime()).toBeLessThan(DAY);
  });
});

describe("formatInterval", () => {
  it("says how long until a date, in the app's language", async () => {
    await i18n.changeLanguage("en");
    expect(formatInterval(new Date(NOW.getTime() + 4 * DAY), NOW)).toBe(
      "4 days"
    );
    expect(formatInterval(new Date(NOW.getTime() + 10 * MINUTE), NOW)).toBe(
      "10 minutes"
    );

    // Computed a moment before it is shown: just under a whole unit still
    // reads as that unit, not "60 seconds" or "24 hours".
    expect(formatInterval(new Date(NOW.getTime() + MINUTE - 200), NOW)).toBe(
      "1 minute"
    );
    expect(formatInterval(new Date(NOW.getTime() + DAY - 200), NOW)).toBe(
      "1 day"
    );
    expect(formatInterval(new Date(NOW.getTime() + 3 * 60 * MINUTE), NOW)).toBe(
      "3 hours"
    );

    await i18n.changeLanguage("pt-BR");
    expect(formatInterval(new Date(NOW.getTime() + 4 * DAY), NOW)).toBe(
      "4 dias"
    );
    await i18n.changeLanguage("en");
  });
});

describe("formatRelativeDue", () => {
  const t = i18n.t.bind(i18n);

  it("reads today, tomorrow, in N days and overdue", () => {
    expect(formatRelativeDue(new Date(2026, 9, 2, 20, 0), NOW, t)).toBe(
      i18n.t("reviewDueToday")
    );
    expect(formatRelativeDue(new Date(2026, 9, 3, 8, 0), NOW, t)).toBe(
      i18n.t("reviewDueTomorrow")
    );
    expect(formatRelativeDue(new Date(2026, 9, 6, 8, 0), NOW, t)).toBe(
      i18n.t("reviewDueInDays", { count: 4 })
    );
    expect(formatRelativeDue(new Date(2026, 8, 30, 8, 0), NOW, t)).toBe(
      i18n.t("todayUrgencyOverdue", { count: 2 })
    );
  });
});
