import { z } from "zod";
import { isDayKey, STUDY_GOALS } from "@/utils/study-goal";

/**
 * The study goal and the test's day (docs/architecture/scheduling.md D1): a
 * test needs a valid day; "Nunca mais esquecer" has none.
 */
const studyGoalFields = {
  studyGoal: z.enum(STUDY_GOALS).optional(),
  targetDate: z.string().refine(isDayKey).nullable().optional(),
};

function requireDayForTest(
  input: { studyGoal?: string; targetDate?: string | null },
  context: z.RefinementCtx
) {
  if (input.studyGoal === "test_prep" && !input.targetDate) {
    context.addIssue({
      code: "custom",
      message: "A test needs its day",
      path: ["targetDate"],
    });
  }
}

export const createProgramInputSchema = z
  .object({
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    name: z.string().min(1),
    ...studyGoalFields,
  })
  .superRefine(requireDayForTest);

export const updateProgramInputSchema = z
  .object({
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    id: z.string(),
    name: z.string().min(1),
    ...studyGoalFields,
  })
  .superRefine(requireDayForTest);

export const softDeleteProgramInputSchema = z.object({
  id: z.string(),
});

/** A program in Markdown (docs/specs/program-import.md). */
export const importProgramInputSchema = z.object({
  markdown: z.string(),
});

export const undoProgramImportInputSchema = z.object({
  created: z.object({
    activityIds: z.array(z.string()),
    examIds: z.array(z.string()),
    moduleIds: z.array(z.string()),
    programId: z.string().nullable(),
  }),
});
