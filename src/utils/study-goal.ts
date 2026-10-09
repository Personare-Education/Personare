/**
 * A program's study goal (docs/architecture/scheduling.md D1): "Nunca mais
 * esquecer" keeps knowledge over time; "Estudar para uma Prova" prepares for
 * a dated test outside the app. Never named "exam": that is the in-app
 * Provas (docs/specs/exams.md).
 */
export const STUDY_GOALS = ["retain", "test_prep"] as const;

export type StudyGoal = (typeof STUDY_GOALS)[number];

export const DEFAULT_STUDY_GOAL: StudyGoal = "retain";

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The test's day, a local calendar day as `yyyy-MM-dd`, or null if invalid. */
export function parseDayKey(dayKey: string): Date | null {
  const match = DAY_KEY.exec(dayKey);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  // Rejects 2026-02-31 and the like, which Date would roll over.
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function isDayKey(value: string): boolean {
  return parseDayKey(value) !== null;
}
