import { z } from "zod";

export const awardQuizInputSchema = z.object({
  activityId: z.string(),
  correct: z.number().int().min(0),
});
