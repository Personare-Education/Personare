import { z } from "zod";

export const setAutoStartInputSchema = z.object({
  enabled: z.boolean(),
});

export const setTestPrereleasesInputSchema = z.object({
  enabled: z.boolean(),
});

export const setSoundsEnabledInputSchema = z.object({
  enabled: z.boolean(),
});

/** 80% to 95% (docs/specs/desired-retention.md AC-1). */
export const setDesiredRetentionInputSchema = z.object({
  desiredRetention: z.number().min(0.8).max(0.95),
});
