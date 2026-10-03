import { z } from "zod";

export const ensureReviewItemsInputSchema = z.object({
  activityId: z.string().optional(),
});

export const listDueInputSchema = z.object({
  activityId: z.string(),
});

export const submitRatingInputSchema = z.object({
  rating: z.enum(["again", "hard", "good", "easy"]),
  reviewItemId: z.string(),
});

export const markActivityDifficultyInputSchema = z.object({
  activityId: z.string(),
  rating: z.enum(["again", "hard", "good", "easy"]),
});

export const listActivityReviewStateInputSchema = z.object({
  moduleId: z.string(),
});

/** One or the other: a flashcard's review item, or a whole Activity. */
export const previewRatingsInputSchema = z.union([
  z.object({ reviewItemId: z.string() }),
  z.object({ activityId: z.string() }),
]);

export const activityIdInputSchema = z.object({
  activityId: z.string(),
});
