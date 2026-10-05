import { z } from "zod";

export const setAutoStartInputSchema = z.object({
  enabled: z.boolean(),
});

export const setTestPrereleasesInputSchema = z.object({
  enabled: z.boolean(),
});
