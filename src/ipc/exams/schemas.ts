import { z } from "zod";

/** What an exam is made of (docs/specs/exams.md §1 AC-1, AC-2). */
const examFieldsSchema = z.object({
  moduleIds: z.array(z.string()).min(1),
  passingScore: z.number().int().min(1).max(100),
  questionCount: z.number().int().min(1),
  timeLimitMinutes: z.number().int().min(1).nullable(),
  title: z.string().min(1),
});

export const createExamInputSchema = examFieldsSchema.extend({
  programId: z.string(),
});

export const updateExamInputSchema = examFieldsSchema.extend({
  id: z.string(),
});

export const listExamsInputSchema = z.object({
  programId: z.string(),
});

export const examIdInputSchema = z.object({
  id: z.string(),
});

export const examRefInputSchema = z.object({
  examId: z.string(),
});

export const saveAttemptInputSchema = z.object({
  correct: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  examId: z.string(),
  startedAt: z.coerce.date(),
  total: z.number().int().min(0),
});
