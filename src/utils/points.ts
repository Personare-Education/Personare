/**
 * How points are earned and lost (docs/specs/gamification.md §3). Pure:
 * the IPC decides when each applies and keeps the ledger.
 */

export type ReviewRating = "again" | "easy" | "good" | "hard";

const REVIEW_POINTS: Record<ReviewRating, number> = {
  again: 4,
  easy: 12,
  good: 10,
  hard: 8,
};
/** A review done on the day it was due, or before. */
const ON_TIME_BONUS = 5;
const QUIZ_POINTS_PER_RIGHT_ANSWER = 3;
const EXAM_POINTS_PER_RIGHT_ANSWER = 3;
const EXAM_PASS_BONUS = 30;
const STREAK_BONUS_PER_DAY = 0.02;
const STREAK_BONUS_MAX = 0.4;
const OVERDUE_LOSS_EACH = 2;
const OVERDUE_LOSS_MAX_PER_DAY = 30;
const STREAK_BREAK_LOSS = 20;
const STREAK_BREAK_MIN_DAYS = 3;

export function reviewPoints(rating: ReviewRating, onTime: boolean): number {
  return REVIEW_POINTS[rating] + (onTime ? ON_TIME_BONUS : 0);
}

export function quizPoints(correct: number): number {
  return Math.max(0, correct) * QUIZ_POINTS_PER_RIGHT_ANSWER;
}

export function examPoints(correct: number, passed: boolean): number {
  return (
    Math.max(0, correct) * EXAM_POINTS_PER_RIGHT_ANSWER +
    (passed ? EXAM_PASS_BONUS : 0)
  );
}

/** A gain with the streak's bonus: 2% a day, up to 40%. */
export function withStreak(points: number, streakDays: number): number {
  const bonus = Math.min(
    Math.max(0, streakDays) * STREAK_BONUS_PER_DAY,
    STREAK_BONUS_MAX
  );
  return Math.round(points * (1 + bonus));
}

/**
 * Reviews newly more than a day overdue: 2 each, up to 30 a day, counting
 * what was already taken that day.
 */
export function overdueLoss(newlyOverdue: number, takenToday: number): number {
  const room = Math.max(0, OVERDUE_LOSS_MAX_PER_DAY - takenToday);
  const loss = Math.min(newlyOverdue * OVERDUE_LOSS_EACH, room);
  return loss === 0 ? 0 : -loss;
}

/** A streak of 3 days or more that breaks. */
export function streakBreakLoss(streakDays: number): number {
  return streakDays >= STREAK_BREAK_MIN_DAYS ? -STREAK_BREAK_LOSS : 0;
}

/** A loss never takes the season below 0. */
export function clampLoss(loss: number, total: number): number {
  const clamped = Math.max(loss, -Math.max(0, total));
  return clamped === 0 ? 0 : clamped;
}
