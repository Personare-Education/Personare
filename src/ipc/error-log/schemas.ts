import { z } from "zod";

export const recordRendererErrorInputSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
});

export const exportErrorLogInputSchema = z.object({
  filePath: z.string().min(1),
});
