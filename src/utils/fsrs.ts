import type { Card, Grade, ReviewLog, StateType } from "ts-fsrs";
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
} from "ts-fsrs";

/**
 * ts-fsrs's default enable_short_term:true treats a rating as one step in
 * same-session drilling -- a brand-new card's first "Good" schedules the
 * next due date minutes away (a short learning step), only reaching a real
 * multi-day interval once it "graduates" on a later rating. That fits
 * Flashcard review (Issue #16): the user drills the same card repeatedly
 * in one sitting. It does not fit markActivityDifficulty (Issue #77): one
 * rating, once, for a whole Activity just finished -- with the default
 * scheduler that first rating looked like a same-session step too,
 * rescheduling minutes (not days) away, only reaching a sensible interval
 * on a second rating shortly after (reported as a confusing ~2-day jump).
 * enable_short_term:false makes every rating graduate straight to a real,
 * whole-day interval, matching "I just finished this once" semantics.
 */
/**
 * The share of reviews the student wants to get right when one comes due
 * (docs/specs/desired-retention.md): higher means sooner and more reviews.
 * 90% is ts-fsrs's own default.
 */
export const DEFAULT_DESIRED_RETENTION = 0.9;

export interface SchedulerOptions {
  desiredRetention?: number;
  shortTermEnabled?: boolean;
}

const schedulers = new Map<string, ReturnType<typeof fsrs>>();

function schedulerFor(options?: SchedulerOptions) {
  const shortTerm = options?.shortTermEnabled !== false;
  const retention = options?.desiredRetention ?? DEFAULT_DESIRED_RETENTION;
  const key = `${shortTerm}:${retention}`;
  let scheduler = schedulers.get(key);
  if (!scheduler) {
    scheduler = fsrs(
      generatorParameters({
        enable_short_term: shortTerm,
        request_retention: retention,
      })
    );
    schedulers.set(key, scheduler);
  }
  return scheduler;
}

/**
 * Agnostic of which content it schedules (Flashcard or, since Issue #77, a
 * whole quiz/pdf/link Activity) -- none of the FSRS math below reads a
 * foreign key, only the FSRS state fields themselves.
 */
export interface ReviewItemRow {
  createdAt: Date;
  difficulty: number;
  dueDate: Date;
  id: string;
  lapses: number;
  lastRating: string;
  lastReviewedAt: Date | null;
  learningSteps: number;
  ratingHistory: string;
  reps: number;
  scheduledDays: number;
  stability: number;
  state: StateType;
  updatedAt: Date;
}

export interface ReviewItemInsertFields {
  difficulty: number;
  dueDate: Date;
  lapses: number;
  lastReviewedAt: Date | null;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  stability: number;
  state: StateType;
}

export type ReviewItemUpdateFields = ReviewItemInsertFields;

export function createInitialReviewItemFields(): ReviewItemInsertFields {
  const card = createEmptyCard();

  return {
    difficulty: card.difficulty,
    dueDate: card.due,
    lapses: card.lapses,
    lastReviewedAt: card.last_review ?? null,
    learningSteps: card.learning_steps,
    reps: card.reps,
    scheduledDays: card.scheduled_days,
    stability: card.stability,
    state: State[card.state] as StateType,
  };
}

export function toFsrsCard(row: ReviewItemRow): Card {
  return {
    difficulty: row.difficulty,
    due: row.dueDate,
    elapsed_days: 0,
    lapses: row.lapses,
    last_review: row.lastReviewedAt ?? undefined,
    learning_steps: row.learningSteps,
    reps: row.reps,
    scheduled_days: row.scheduledDays,
    stability: row.stability,
    state: State[row.state],
  };
}

export function applyRating(
  row: ReviewItemRow,
  rating: Grade,
  now: Date,
  options?: SchedulerOptions
): { card: Card; log: ReviewLog } {
  return schedulerFor(options).next(toFsrsCard(row), now, rating);
}

export type PreviewRating = "again" | "hard" | "good" | "easy";

const PREVIEW_GRADES: Record<PreviewRating, Grade> = {
  again: Rating.Again,
  easy: Rating.Easy,
  good: Rating.Good,
  hard: Rating.Hard,
};

/**
 * When the next review would be for each rating (docs/specs/rating-clarity.md
 * AC-1), with the same scheduler applyRating uses -- a whole Activity's
 * rating passes shortTermEnabled: false, like markActivityDifficulty. A null
 * row is an item never reviewed (a fresh card).
 */
export function previewRatings(
  row: ReviewItemRow | null,
  now: Date,
  options?: SchedulerOptions
): Record<PreviewRating, Date> {
  const scheduler = schedulerFor(options);
  const card = row ? toFsrsCard(row) : createEmptyCard(now);
  const preview = {} as Record<PreviewRating, Date>;
  for (const [rating, grade] of Object.entries(PREVIEW_GRADES)) {
    preview[rating as PreviewRating] = scheduler.next(
      card,
      now,
      grade
    ).card.due;
  }
  return preview;
}

export function fromFsrsCard(card: Card): ReviewItemUpdateFields {
  return {
    difficulty: card.difficulty,
    dueDate: card.due,
    lapses: card.lapses,
    lastReviewedAt: card.last_review ?? null,
    learningSteps: card.learning_steps,
    reps: card.reps,
    scheduledDays: card.scheduled_days,
    stability: card.stability,
    state: State[card.state] as StateType,
  };
}
