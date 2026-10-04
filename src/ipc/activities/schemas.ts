import { z } from "zod";

import { UNLOCK_MODES } from "@/ipc/shared/sequences";

export const listActivitiesInputSchema = z.object({
  moduleId: z.string(),
  /** A group's sub-activities; without it, the module's first level. */
  parentActivityId: z.string().nullish(),
});

export const createActivityInputSchema = z.object({
  filePath: z.string().nullish(),
  moduleId: z.string(),
  parentActivityId: z.string().nullish(),
  title: z.string().min(1),
  type: z.string().min(1),
  url: z.string().nullish(),
});

export const reorderActivitiesInputSchema = z.object({
  ids: z.array(z.string()),
  moduleId: z.string(),
  parentActivityId: z.string().nullish(),
});

export const setUnlockRuleInputSchema = z.object({
  id: z.string(),
  mode: z.enum(UNLOCK_MODES),
  requiredIds: z.array(z.string()),
});

export const listByProgramInputSchema = z.object({
  programId: z.string(),
});

export const getUnlockRuleInputSchema = z.object({
  id: z.string(),
});

export const completeActivityInputSchema = z.object({
  id: z.string(),
});

export const updateActivityInputSchema = z.object({
  filePath: z.string().nullish(),
  id: z.string(),
  title: z.string().min(1),
  type: z.string().min(1),
  url: z.string().nullish(),
});

export const softDeleteActivityInputSchema = z.object({
  id: z.string(),
});
