import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
  quizOptions as quizOptionsTable,
  quizQuestions as quizQuestionsTable,
} from "@/database/schema";

/**
 * Every cascade helper here only ever sets deletedAt on rows where it is
 * currently NULL -- a row that was already soft-deleted independently
 * before (with its own timestamp) must never be overwritten by a parent's
 * cascade. None of these touch review_items: it has no deletedAt column by
 * design (Issue #16) and already becomes invisible to every review/calendar
 * query as soon as its flashcard is correctly cascaded.
 */

export function cascadeSoftDeleteQuizQuestion(
  db: DatabaseClient,
  questionId: string,
  now: Date
) {
  db.update(quizOptionsTable)
    .set({ deletedAt: now })
    .where(
      and(
        eq(quizOptionsTable.questionId, questionId),
        isNull(quizOptionsTable.deletedAt)
      )
    )
    .run();
}

export function cascadeSoftDeleteActivity(
  db: DatabaseClient,
  activityId: string,
  now: Date
) {
  db.update(flashcardsTable)
    .set({ deletedAt: now })
    .where(
      and(
        eq(flashcardsTable.activityId, activityId),
        isNull(flashcardsTable.deletedAt)
      )
    )
    .run();

  const questionIds = db
    .select({ id: quizQuestionsTable.id })
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.activityId, activityId))
    .all()
    .map((row) => row.id);

  db.update(quizQuestionsTable)
    .set({ deletedAt: now })
    .where(
      and(
        eq(quizQuestionsTable.activityId, activityId),
        isNull(quizQuestionsTable.deletedAt)
      )
    )
    .run();

  if (questionIds.length > 0) {
    db.update(quizOptionsTable)
      .set({ deletedAt: now })
      .where(
        and(
          inArray(quizOptionsTable.questionId, questionIds),
          isNull(quizOptionsTable.deletedAt)
        )
      )
      .run();
  }
}

export function cascadeSoftDeleteModule(
  db: DatabaseClient,
  moduleId: string,
  now: Date
) {
  const activityIds = db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(eq(activitiesTable.moduleId, moduleId))
    .all()
    .map((row) => row.id);

  db.update(activitiesTable)
    .set({ deletedAt: now })
    .where(
      and(
        eq(activitiesTable.moduleId, moduleId),
        isNull(activitiesTable.deletedAt)
      )
    )
    .run();

  for (const activityId of activityIds) {
    cascadeSoftDeleteActivity(db, activityId, now);
  }
}

/*
 * Undoing a deletion (docs/specs/safety-net.md): every row a cascade above
 * hid carries the exact deletedAt of that one deletion, so restoring clears
 * only rows with that same value. A child deleted on its own before (with
 * its own, earlier timestamp) stays deleted.
 */

export function cascadeRestoreQuizQuestion(
  db: DatabaseClient,
  questionId: string,
  deletedAt: Date
) {
  db.update(quizOptionsTable)
    .set({ deletedAt: null })
    .where(
      and(
        eq(quizOptionsTable.questionId, questionId),
        eq(quizOptionsTable.deletedAt, deletedAt)
      )
    )
    .run();
}

export function cascadeRestoreActivity(
  db: DatabaseClient,
  activityId: string,
  deletedAt: Date
) {
  db.update(flashcardsTable)
    .set({ deletedAt: null })
    .where(
      and(
        eq(flashcardsTable.activityId, activityId),
        eq(flashcardsTable.deletedAt, deletedAt)
      )
    )
    .run();

  const questionIds = db
    .select({ id: quizQuestionsTable.id })
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.activityId, activityId))
    .all()
    .map((row) => row.id);

  db.update(quizQuestionsTable)
    .set({ deletedAt: null })
    .where(
      and(
        eq(quizQuestionsTable.activityId, activityId),
        eq(quizQuestionsTable.deletedAt, deletedAt)
      )
    )
    .run();

  for (const questionId of questionIds) {
    cascadeRestoreQuizQuestion(db, questionId, deletedAt);
  }
}

export function cascadeRestoreModule(
  db: DatabaseClient,
  moduleId: string,
  deletedAt: Date
) {
  const activityIds = db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(eq(activitiesTable.moduleId, moduleId))
    .all()
    .map((row) => row.id);

  db.update(activitiesTable)
    .set({ deletedAt: null })
    .where(
      and(
        eq(activitiesTable.moduleId, moduleId),
        eq(activitiesTable.deletedAt, deletedAt)
      )
    )
    .run();

  for (const activityId of activityIds) {
    cascadeRestoreActivity(db, activityId, deletedAt);
  }
}
