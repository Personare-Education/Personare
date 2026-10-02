import { os } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { activities, quizOptions, quizQuestions } from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  cascadeRestoreQuizQuestion,
  cascadeSoftDeleteQuizQuestion,
} from "@/ipc/shared/cascade-soft-delete";
import {
  createOptionInputSchema,
  createQuestionInputSchema,
  createWithQuestionsInputSchema,
  listOptionsInputSchema,
  listQuestionsInputSchema,
  softDeleteOptionInputSchema,
  softDeleteQuestionInputSchema,
  updateOptionInputSchema,
  updateQuestionInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const listQuestions = os
  .input(listQuestionsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .select()
      .from(quizQuestions)
      .where(
        and(
          eq(quizQuestions.activityId, input.activityId),
          isNull(quizQuestions.deletedAt)
        )
      )
      .orderBy(asc(quizQuestions.createdAt))
      .all();
  });

export const createQuestion = os
  .input(createQuestionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    return db
      .insert(quizQuestions)
      .values({
        activityId: input.activityId,
        createdAt: now,
        imagePath: input.imagePath ?? null,
        text: input.text,
        updatedAt: now,
      })
      .returning()
      .get();
  });

export const updateQuestion = os
  .input(updateQuestionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .update(quizQuestions)
      .set({
        imagePath: input.imagePath ?? null,
        text: input.text,
        updatedAt: new Date(),
      })
      .where(eq(quizQuestions.id, input.id))
      .returning()
      .get();
  });

export const softDeleteQuestion = os
  .input(softDeleteQuestionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    db.update(quizQuestions)
      .set({ deletedAt: now })
      .where(eq(quizQuestions.id, input.id))
      .run();

    cascadeSoftDeleteQuizQuestion(db, input.id, now);
  });

/** Undoes softDelete: the row and what its deletion hid (docs/specs/safety-net.md). */
export const restoreQuestion = os
  .input(softDeleteQuestionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const row = db
      .select({ deletedAt: quizQuestions.deletedAt })
      .from(quizQuestions)
      .where(eq(quizQuestions.id, input.id))
      .get();
    if (!row?.deletedAt) {
      return;
    }

    db.update(quizQuestions)
      .set({ deletedAt: null })
      .where(eq(quizQuestions.id, input.id))
      .run();

    cascadeRestoreQuizQuestion(db, input.id, row.deletedAt);
  });

export const listOptions = os
  .input(listOptionsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .select()
      .from(quizOptions)
      .where(
        and(
          eq(quizOptions.questionId, input.questionId),
          isNull(quizOptions.deletedAt)
        )
      )
      .orderBy(asc(quizOptions.createdAt))
      .all();
  });

export const createOption = os
  .input(createOptionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    return db
      .insert(quizOptions)
      .values({
        createdAt: now,
        imagePath: input.imagePath ?? null,
        isCorrect: input.isCorrect,
        questionId: input.questionId,
        text: input.text,
        updatedAt: now,
      })
      .returning()
      .get();
  });

export const updateOption = os
  .input(updateOptionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .update(quizOptions)
      .set({
        imagePath: input.imagePath ?? null,
        isCorrect: input.isCorrect,
        text: input.text,
        updatedAt: new Date(),
      })
      .where(eq(quizOptions.id, input.id))
      .returning()
      .get();
  });

export const softDeleteOption = os
  .input(softDeleteOptionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    db.update(quizOptions)
      .set({ deletedAt: new Date() })
      .where(eq(quizOptions.id, input.id))
      .run();
  });

/**
 * Creates a quiz activity together with its questions and options (imported
 * from an AI-generated Markdown file, see docs/specs/quiz-ai-import.md) in one
 * transaction, so a failure never leaves a half-imported quiz behind.
 * Questions and options are listed by createdAt, so each row gets a
 * strictly increasing timestamp to keep the file's order.
 */
export const createWithQuestions = os
  .input(createWithQuestionsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const start = Date.now();
    let tick = 0;
    const nextTimestamp = () => {
      tick += 1;
      return new Date(start + tick);
    };

    return db.transaction((tx) => {
      const createdAt = nextTimestamp();
      const activity = tx
        .insert(activities)
        .values({
          createdAt,
          moduleId: input.moduleId,
          title: input.title,
          type: "quiz",
          updatedAt: createdAt,
        })
        .returning()
        .get();

      for (const question of input.questions) {
        const questionCreatedAt = nextTimestamp();
        const { id: questionId } = tx
          .insert(quizQuestions)
          .values({
            activityId: activity.id,
            createdAt: questionCreatedAt,
            text: question.text,
            updatedAt: questionCreatedAt,
          })
          .returning({ id: quizQuestions.id })
          .get();

        for (const option of question.options) {
          const optionCreatedAt = nextTimestamp();
          tx.insert(quizOptions)
            .values({
              createdAt: optionCreatedAt,
              isCorrect: option.isCorrect,
              questionId,
              text: option.text,
              updatedAt: optionCreatedAt,
            })
            .run();
        }
      }

      return activity;
    });
  });
