import { z } from "zod";

export const createProgramInputSchema = z.object({
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  name: z.string().min(1),
});

export const updateProgramInputSchema = z.object({
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  id: z.string(),
  name: z.string().min(1),
});

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
