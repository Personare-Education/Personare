import { os } from "@orpc/server";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import type { Grade, StateType } from "ts-fsrs";
import { Rating } from "ts-fsrs";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
  modules as modulesTable,
  pendingActivityRatings as pendingActivityRatingsTable,
  programs as programsTable,
  reviewItems as reviewItemsTable,
  reviewLogs as reviewLogsTable,
} from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import { getOrCreateAppSettings } from "@/ipc/settings/handlers";
import { loadLocks } from "@/ipc/shared/locks";
import { recordReviewPoints } from "@/ipc/shared/points";
import { programOfReviewItem } from "@/ipc/shared/review-item-program";
import { loadActivityCounts, loadSchedule } from "@/ipc/shared/schedule";
import {
  activityOfFlashcard,
  markActivityCompleted,
} from "@/ipc/shared/sequences";
import {
  applyRating,
  createInitialReviewItemFields,
  fromFsrsCard,
  type PreviewRating,
  previewRatings as previewFsrsRatings,
  type ReviewItemRow,
  retrievabilityAt,
} from "@/utils/fsrs";
import { computeRetention } from "@/utils/retention-stats";
import { scheduleForGoal } from "@/utils/scheduling-policy";
import {
  activityIdInputSchema,
  ensureReviewItemsInputSchema,
  listActivityReviewStateInputSchema,
  listDueInputSchema,
  markActivityDifficultyInputSchema,
  previewRatingsInputSchema,
  submitRatingInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the student picked in Settings (docs/specs/desired-retention.md). */
function desiredRetentionOf(db: DatabaseClient) {
  return getOrCreateAppSettings(db).desiredRetention;
}

/** The preview, with the program's goal applied as rating would (D7). */
function withGoal(
  preview: Record<PreviewRating, Date>,
  program: ReturnType<typeof programOfReviewItem>,
  now: Date
): Record<PreviewRating, Date> {
  return {
    again: scheduleForGoal(preview.again, program, now),
    easy: scheduleForGoal(preview.easy, program, now),
    good: scheduleForGoal(preview.good, program, now),
    hard: scheduleForGoal(preview.hard, program, now),
  };
}

const RATING_TO_GRADE: Record<"again" | "hard" | "good" | "easy", Grade> = {
  again: Rating.Again,
  easy: Rating.Easy,
  good: Rating.Good,
  hard: Rating.Hard,
};

/**
 * Shared by submitRating (Flashcard review) and markActivityDifficulty
 * (Activity review, Issue #77) -- both apply a rating to an existing
 * review_items row the same way, they only differ in how that row gets
 * found/created in the first place.
 */
function applyRatingToReviewItem(
  db: DatabaseClient,
  row: typeof reviewItemsTable.$inferSelect,
  rating: "again" | "hard" | "good" | "easy",
  now: Date,
  options?: { durationMs?: number; shortTermEnabled?: boolean }
) {
  const reviewRow: ReviewItemRow = { ...row, state: row.state as StateType };
  const grade = RATING_TO_GRADE[rating];
  const desiredRetention = desiredRetentionOf(db);
  const schedulerOptions = {
    desiredRetention,
    shortTermEnabled: options?.shortTermEnabled,
  };
  const { card } = applyRating(reviewRow, grade, now, schedulerOptions);
  const program = programOfReviewItem(db, row);
  const proposed = fromFsrsCard(card);
  // The program's goal decides the due date (docs/architecture/scheduling.md
  // D6, D7): for a test, nothing after its eve.
  const dueDate = scheduleForGoal(proposed.dueDate, program, now);
  const fields =
    dueDate === proposed.dueDate
      ? proposed
      : {
          ...proposed,
          dueDate,
          scheduledDays: Math.max(
            0,
            Math.round((dueDate.getTime() - now.getTime()) / DAY_MS)
          ),
        };

  const history = JSON.parse(row.ratingHistory) as {
    rating: string;
    reviewedAt: number;
  }[];
  history.push({ rating, reviewedAt: now.getTime() });

  return db.transaction((tx) => {
    const updated = tx
      .update(reviewItemsTable)
      .set({
        difficulty: fields.difficulty,
        dueDate: fields.dueDate,
        lapses: fields.lapses,
        lastRating: rating,
        lastReviewedAt: fields.lastReviewedAt,
        learningSteps: fields.learningSteps,
        ratingHistory: JSON.stringify(history),
        reps: fields.reps,
        scheduledDays: fields.scheduledDays,
        stability: fields.stability,
        state: fields.state,
        updatedAt: now,
      })
      .where(eq(reviewItemsTable.id, row.id))
      .returning()
      .get();

    // docs/architecture/scheduling.md D3: what calibration and the
    // simulator read.
    tx.insert(reviewLogsTable)
      .values({
        desiredRetention,
        difficultyAfter: fields.difficulty,
        difficultyBefore: row.difficulty,
        dueAfter: fields.dueDate,
        durationMs: options?.durationMs ?? null,
        elapsedDays: row.lastReviewedAt
          ? (now.getTime() - row.lastReviewedAt.getTime()) / DAY_MS
          : null,
        itemKind: row.flashcardId ? "recall" : "coverage",
        rating,
        retrievabilityBefore: retrievabilityAt(
          reviewRow,
          now,
          schedulerOptions
        ),
        reviewedAt: now,
        reviewItemId: row.id,
        stabilityAfter: fields.stability,
        stabilityBefore: row.stability,
        stateAfter: fields.state,
        stateBefore: row.state,
        studyGoal: program?.studyGoal ?? null,
      })
      .run();

    return updated;
  });
}

export const ensureReviewItems = os
  .input(ensureReviewItemsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    const scopeCondition = input.activityId
      ? eq(flashcardsTable.activityId, input.activityId)
      : undefined;

    const flashcardsWithoutReviewItems = db
      .select({ id: flashcardsTable.id })
      .from(flashcardsTable)
      .leftJoin(
        reviewItemsTable,
        eq(reviewItemsTable.flashcardId, flashcardsTable.id)
      )
      .where(
        and(
          scopeCondition,
          isNull(flashcardsTable.deletedAt),
          isNull(reviewItemsTable.id)
        )
      )
      .all();

    if (flashcardsWithoutReviewItems.length === 0) {
      return;
    }

    const now = new Date();

    db.insert(reviewItemsTable)
      .values(
        flashcardsWithoutReviewItems.map((flashcard) => {
          const fields = createInitialReviewItemFields();

          return {
            createdAt: now,
            difficulty: fields.difficulty,
            dueDate: fields.dueDate,
            flashcardId: flashcard.id,
            lapses: fields.lapses,
            lastRating: "",
            lastReviewedAt: fields.lastReviewedAt,
            learningSteps: fields.learningSteps,
            ratingHistory: "[]",
            reps: fields.reps,
            scheduledDays: fields.scheduledDays,
            stability: fields.stability,
            state: fields.state,
            updatedAt: now,
          };
        })
      )
      .run();
  });

export const listDue = os.input(listDueInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  const now = new Date();

  return db
    .select({
      back: flashcardsTable.back,
      backImagePath: flashcardsTable.backImagePath,
      dueDate: reviewItemsTable.dueDate,
      front: flashcardsTable.front,
      frontImagePath: flashcardsTable.frontImagePath,
      id: reviewItemsTable.id,
    })
    .from(reviewItemsTable)
    .innerJoin(
      flashcardsTable,
      eq(reviewItemsTable.flashcardId, flashcardsTable.id)
    )
    .where(
      and(
        eq(flashcardsTable.activityId, input.activityId),
        isNull(flashcardsTable.deletedAt),
        lte(reviewItemsTable.dueDate, now)
      )
    )
    .orderBy(asc(reviewItemsTable.dueDate))
    .all();
});

/**
 * Union of the two review_items origins (Issue #77): the pre-existing
 * Flashcard-scoped branch (flashcard -> its Activity), and the
 * Activity-scoped branch (a quiz/pdf/link review_items row references its
 * Activity directly, no Flashcard involved -- front has nothing to project
 * there, so it's a literal NULL). Both branches join the same way from
 * Activity up to Module/Program.
 */
export const listSchedule = os.handler(() =>
  loadSchedule(requireDatabaseClient())
);

/** What is locked, and what each still needs (§2 AC-5). */
export const listLocks = os.handler(() => loadLocks(requireDatabaseClient()));

/**
 * What each rating would schedule (docs/specs/rating-clarity.md AC-1): a
 * flashcard's review item with its short learning steps, or a whole
 * Activity in whole days -- the same schedulers submitRating and
 * markActivityDifficulty use. An Activity never rated previews a fresh card.
 */
export const previewRatings = os
  .input(previewRatingsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    if ("reviewItemId" in input) {
      const row = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.id, input.reviewItemId))
        .get();
      if (!row) {
        throw new Error("Review item not found");
      }
      return withGoal(
        previewFsrsRatings({ ...row, state: row.state as StateType }, now, {
          desiredRetention: desiredRetentionOf(db),
        }),
        programOfReviewItem(db, row),
        now
      );
    }

    const row = db
      .select()
      .from(reviewItemsTable)
      .where(eq(reviewItemsTable.activityId, input.activityId))
      .get();
    return withGoal(
      previewFsrsRatings(
        row ? { ...row, state: row.state as StateType } : null,
        now,
        { desiredRetention: desiredRetentionOf(db), shortTermEnabled: false }
      ),
      programOfReviewItem(db, {
        activityId: input.activityId,
        flashcardId: null,
      }),
      now
    );
  });

export const submitRating = os
  .input(submitRatingInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    const row = db
      .select()
      .from(reviewItemsTable)
      .where(eq(reviewItemsTable.id, input.reviewItemId))
      .get();

    if (!row) {
      throw new Error("Review item not found");
    }

    const now = new Date();
    const rated = applyRatingToReviewItem(db, row, input.rating, now, {
      durationMs: input.durationMs,
    });
    // Its points, on time or not by when it was due (gamification.md §3).
    recordReviewPoints(db, {
      dueDate: row.reps === 0 ? null : row.dueDate,
      itemId: row.id,
      now,
      rating: input.rating,
    });
    // A deck is done once its first card is rated
    // (docs/specs/sequences-and-locks.md §1 AC-6).
    const deckId = row.flashcardId
      ? activityOfFlashcard(db, row.flashcardId)
      : row.activityId;
    if (deckId) {
      markActivityCompleted(db, deckId, now);
    }
    return rated;
  });

/**
 * One review_item per whole Activity (Issue #77), get-or-created and rated
 * in the same call: there is no separate "ensure" step like Flashcard
 * review has, since the only way this row is ever created is the user
 * marking the Activity done with a rating -- the first mark is a real FSRS
 * review, not just an empty row waiting to be reviewed later.
 */
export const markActivityDifficulty = os
  .input(markActivityDifficultyInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    let row = db
      .select()
      .from(reviewItemsTable)
      .where(eq(reviewItemsTable.activityId, input.activityId))
      .get();

    if (!row) {
      const fields = createInitialReviewItemFields();

      row = db
        .insert(reviewItemsTable)
        .values({
          activityId: input.activityId,
          createdAt: now,
          difficulty: fields.difficulty,
          dueDate: fields.dueDate,
          lapses: fields.lapses,
          lastRating: "",
          lastReviewedAt: fields.lastReviewedAt,
          learningSteps: fields.learningSteps,
          ratingHistory: "[]",
          reps: fields.reps,
          scheduledDays: fields.scheduledDays,
          stability: fields.stability,
          state: fields.state,
          updatedAt: now,
        })
        .returning()
        .get();
    }

    const rated = applyRatingToReviewItem(db, row, input.rating, now, {
      durationMs: input.durationMs,
      shortTermEnabled: false,
    });
    markActivityCompleted(db, input.activityId, now);
    // Its points, on time or not by when it was due (gamification.md §3).
    recordReviewPoints(db, {
      dueDate: row.reps === 0 ? null : row.dueDate,
      itemId: row.id,
      now,
      rating: input.rating,
    });
    return rated;
  });

/**
 * Powers the Programs page's per-card activity heatmap (Issue #99): one row
 * per program/day that had at least one rating, `date` a local calendar-day
 * key (not UTC -- same reasoning as src/routes/calendar.tsx's dueDate
 * handling). There is no normalized per-rating log table (see
 * docs/specs/issue-99-programs-cards-heatmap.md "Escolhas técnicas"), so
 * this flattens every review_item's `ratingHistory` JSON blob in memory,
 * reusing listSchedule's Flashcard-scoped/Activity-scoped union to reach
 * each review_item's program.
 */
export const listActivityCounts = os.handler(() =>
  loadActivityCounts(requireDatabaseClient())
);

export const listActivityReviewState = os
  .input(listActivityReviewStateInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    const activityRows = db
      .select({
        activityId: reviewItemsTable.activityId,
        dueDate: reviewItemsTable.dueDate,
        lastRating: reviewItemsTable.lastRating,
      })
      .from(reviewItemsTable)
      .innerJoin(
        activitiesTable,
        eq(reviewItemsTable.activityId, activitiesTable.id)
      )
      .where(
        and(
          eq(activitiesTable.moduleId, input.moduleId),
          isNull(activitiesTable.deletedAt)
        )
      )
      .all();

    // A deck is rated card by card: one row per deck, from its cards -- the
    // earliest due date and the rating of the card rated last
    // (docs/specs/layout-tables.md AC-1).
    const cardRows = db
      .select({
        activityId: flashcardsTable.activityId,
        dueDate: reviewItemsTable.dueDate,
        lastRating: reviewItemsTable.lastRating,
        lastReviewedAt: reviewItemsTable.lastReviewedAt,
      })
      .from(reviewItemsTable)
      .innerJoin(
        flashcardsTable,
        eq(reviewItemsTable.flashcardId, flashcardsTable.id)
      )
      .innerJoin(
        activitiesTable,
        eq(flashcardsTable.activityId, activitiesTable.id)
      )
      .where(
        and(
          eq(activitiesTable.moduleId, input.moduleId),
          isNull(activitiesTable.deletedAt),
          isNull(flashcardsTable.deletedAt)
        )
      )
      .all();

    const decks = new Map<
      string,
      { dueDate: Date; lastRating: string; lastReviewedAt: number }
    >();
    for (const card of cardRows) {
      const reviewedAt = card.lastReviewedAt?.getTime() ?? -1;
      const deck = decks.get(card.activityId);
      if (!deck) {
        decks.set(card.activityId, {
          dueDate: card.dueDate,
          lastRating: reviewedAt >= 0 ? card.lastRating : "",
          lastReviewedAt: reviewedAt,
        });
        continue;
      }
      if (card.dueDate < deck.dueDate) {
        deck.dueDate = card.dueDate;
      }
      if (reviewedAt > deck.lastReviewedAt) {
        deck.lastReviewedAt = reviewedAt;
        deck.lastRating = card.lastRating;
      }
    }

    const deckRows = Array.from(decks, ([activityId, deck]) => ({
      activityId,
      dueDate: deck.dueDate,
      lastRating: deck.lastRating,
    }));

    return [...activityRows, ...deckRows];
  });

/**
 * Records that an Activity was opened/finished and still needs a rating
 * (Issue #103) -- see docs/specs/issue-103-pdf-native-open-difficulty-flow.md
 * for why this can't just be an unrated review_items row. Idempotent: a
 * second arm for the same Activity (e.g. the user reopens the same PDF
 * again before ever rating it) is a no-op, not a duplicate/refreshed row.
 */
export const armPendingActivityRating = os
  .input(activityIdInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    db.insert(pendingActivityRatingsTable)
      .values({ activityId: input.activityId, createdAt: new Date() })
      .onConflictDoNothing()
      .run();
  });

export const clearPendingActivityRating = os
  .input(activityIdInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    db.delete(pendingActivityRatingsTable)
      .where(eq(pendingActivityRatingsTable.activityId, input.activityId))
      .run();
  });

/**
 * The oldest pending rating, if any -- surfaced app-wide on launch
 * (src/routes/__root.tsx) so it reopens ActivityDifficultyDialog even if the
 * app was fully closed before the user picked a rating. Joined all the way
 * to Program/Module (unlike every other review query, which stops at
 * Activity) because the dialog needs to display them, and this is the one
 * entry point with no route context of its own to already have them in
 * scope.
 */
export const getPendingActivityRating = os.handler(() => {
  const db = requireDatabaseClient();

  return (
    db
      .select({
        activityId: activitiesTable.id,
        activityTitle: activitiesTable.title,
        moduleName: modulesTable.name,
        programName: programsTable.name,
      })
      .from(pendingActivityRatingsTable)
      .innerJoin(
        activitiesTable,
        eq(pendingActivityRatingsTable.activityId, activitiesTable.id)
      )
      .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
      .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
      .where(
        and(
          isNull(activitiesTable.deletedAt),
          isNull(modulesTable.deletedAt),
          isNull(programsTable.deletedAt)
        )
      )
      .orderBy(asc(pendingActivityRatingsTable.createdAt))
      .limit(1)
      .get() ?? null
  );
});

/**
 * How much the student remembered in the last 30 days, next to the target
 * they set (docs/specs/retention-summary.md AC-2).
 */
export const retentionStats = os.handler(() => {
  const db = requireDatabaseClient();
  const histories = db
    .select({ ratingHistory: reviewItemsTable.ratingHistory })
    .from(reviewItemsTable)
    .all()
    .map((row) => row.ratingHistory);
  return {
    ...computeRetention(histories, new Date()),
    desiredRetention: desiredRetentionOf(db),
  };
});
