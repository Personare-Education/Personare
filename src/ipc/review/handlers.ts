import { os } from "@orpc/server";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
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
} from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  activityOfFlashcard,
  markActivityCompleted,
} from "@/ipc/shared/sequences";
import {
  applyRating,
  createInitialReviewItemFields,
  fromFsrsCard,
  previewRatings as previewFsrsRatings,
  type ReviewItemRow,
} from "@/utils/fsrs";
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
  options?: { shortTermEnabled?: boolean }
) {
  const reviewRow: ReviewItemRow = { ...row, state: row.state as StateType };
  const grade = RATING_TO_GRADE[rating];
  const { card } = applyRating(reviewRow, grade, now, options);
  const fields = fromFsrsCard(card);

  const history = JSON.parse(row.ratingHistory) as {
    rating: string;
    reviewedAt: number;
  }[];
  history.push({ rating, reviewedAt: now.getTime() });

  return db
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
export const listSchedule = os.handler(() => {
  const db = requireDatabaseClient();

  const viaFlashcard = db
    .select({
      activityFilePath: activitiesTable.filePath,
      activityId: activitiesTable.id,
      activityTitle: activitiesTable.title,
      activityType: activitiesTable.type,
      activityUrl: activitiesTable.url,
      dueDate: reviewItemsTable.dueDate,
      // Widened to string | null (flashcards.front is actually never null
      // here) only so this branch's shape matches viaActivity's for
      // unionAll -- Activity-scoped rows have no Flashcard to project a
      // front from.
      front: sql<string | null>`${flashcardsTable.front}`,
      id: reviewItemsTable.id,
      moduleId: modulesTable.id,
      moduleName: modulesTable.name,
      // The "Today" screen paints each item in its program's color
      // (docs/specs/today-review-queue.md).
      programColor: programsTable.color,
      programId: programsTable.id,
      programName: programsTable.name,
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
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(flashcardsTable.deletedAt));

  const viaActivity = db
    .select({
      activityFilePath: activitiesTable.filePath,
      activityId: activitiesTable.id,
      activityTitle: activitiesTable.title,
      activityType: activitiesTable.type,
      activityUrl: activitiesTable.url,
      dueDate: reviewItemsTable.dueDate,
      front: sql<string | null>`NULL`,
      id: reviewItemsTable.id,
      moduleId: modulesTable.id,
      moduleName: modulesTable.name,
      // The "Today" screen paints each item in its program's color
      // (docs/specs/today-review-queue.md).
      programColor: programsTable.color,
      programId: programsTable.id,
      programName: programsTable.name,
    })
    .from(reviewItemsTable)
    .innerJoin(
      activitiesTable,
      eq(reviewItemsTable.activityId, activitiesTable.id)
    )
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(activitiesTable.deletedAt));

  return unionAll(viaFlashcard, viaActivity).all();
});

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
      return previewFsrsRatings({ ...row, state: row.state as StateType }, now);
    }

    const row = db
      .select()
      .from(reviewItemsTable)
      .where(eq(reviewItemsTable.activityId, input.activityId))
      .get();
    return previewFsrsRatings(
      row ? { ...row, state: row.state as StateType } : null,
      now,
      { shortTermEnabled: false }
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
    const rated = applyRatingToReviewItem(db, row, input.rating, now);
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
      shortTermEnabled: false,
    });
    markActivityCompleted(db, input.activityId, now);
    return rated;
  });

function toLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

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
export const listActivityCounts = os.handler(() => {
  const db = requireDatabaseClient();

  const viaFlashcard = db
    .select({
      activityId: activitiesTable.id,
      programId: programsTable.id,
      ratingHistory: reviewItemsTable.ratingHistory,
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
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(flashcardsTable.deletedAt));

  const viaActivity = db
    .select({
      activityId: activitiesTable.id,
      programId: programsTable.id,
      ratingHistory: reviewItemsTable.ratingHistory,
    })
    .from(reviewItemsTable)
    .innerJoin(
      activitiesTable,
      eq(reviewItemsTable.activityId, activitiesTable.id)
    )
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(activitiesTable.deletedAt));

  const rows = unionAll(viaFlashcard, viaActivity).all();

  // `count` is every rating (the heatmap's); `activities` each activity once
  // (docs/specs/clarify-daily-count.md AC-4).
  const byProgramAndDate = new Map<
    string,
    Map<string, { activities: Set<string>; count: number }>
  >();

  for (const row of rows) {
    const history = JSON.parse(row.ratingHistory) as { reviewedAt: number }[];

    for (const entry of history) {
      const dateKey = toLocalDateKey(new Date(entry.reviewedAt));
      const byDate =
        byProgramAndDate.get(row.programId) ??
        new Map<string, { activities: Set<string>; count: number }>();
      const day = byDate.get(dateKey) ?? {
        activities: new Set<string>(),
        count: 0,
      };
      day.count += 1;
      day.activities.add(row.activityId);
      byDate.set(dateKey, day);
      byProgramAndDate.set(row.programId, byDate);
    }
  }

  const result: {
    activities: number;
    count: number;
    date: string;
    programId: string;
  }[] = [];

  for (const [programId, byDate] of byProgramAndDate) {
    for (const [date, day] of byDate) {
      result.push({
        activities: day.activities.size,
        count: day.count,
        date,
        programId,
      });
    }
  }

  return result;
});

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
