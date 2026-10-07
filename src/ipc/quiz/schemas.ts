import { z } from "zod";

/**
 * A question belongs to a quiz or, standalone, to an exam: exactly one of
 * the two (docs/specs/exams.md §1 AC-6).
 */
const questionOwnerSchema = z.object({
  activityId: z.string().optional(),
  examId: z.string().optional(),
});

function hasOneOwner(owner: z.infer<typeof questionOwnerSchema>) {
  return (owner.activityId === undefined) !== (owner.examId === undefined);
}

const ONE_OWNER_MESSAGE = "A question belongs to an activity or an exam";

export const listQuestionsInputSchema = questionOwnerSchema.refine(
  hasOneOwner,
  ONE_OWNER_MESSAGE
);

export const createQuestionInputSchema = questionOwnerSchema
  .extend({
    imagePath: z.string().nullable().optional(),
    text: z.string().min(1),
  })
  .refine(hasOneOwner, ONE_OWNER_MESSAGE);

export const updateQuestionInputSchema = z.object({
  id: z.string(),
  imagePath: z.string().nullable().optional(),
  text: z.string().min(1),
});

export const softDeleteQuestionInputSchema = z.object({
  id: z.string(),
});

export const listOptionsInputSchema = z.object({
  questionId: z.string(),
});

export const createOptionInputSchema = z.object({
  imagePath: z.string().nullable().optional(),
  isCorrect: z.boolean().default(false),
  questionId: z.string(),
  text: z.string().min(1),
});

export const updateOptionInputSchema = z.object({
  id: z.string(),
  imagePath: z.string().nullable().optional(),
  isCorrect: z.boolean(),
  text: z.string().min(1),
});

export const softDeleteOptionInputSchema = z.object({
  id: z.string(),
});

export const createWithQuestionsInputSchema = z.object({
  moduleId: z.string(),
  /** Inside a sequence (docs/specs/sequences-and-locks.md §3 AC-5). */
  parentActivityId: z.string().nullish(),
  questions: z
    .array(
      z.object({
        options: z
          .array(z.object({ isCorrect: z.boolean(), text: z.string().min(1) }))
          .min(2),
        text: z.string().min(1),
      })
    )
    .min(1),
  title: z.string().min(1),
});
