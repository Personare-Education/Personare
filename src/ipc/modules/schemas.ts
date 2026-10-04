import { z } from "zod";
import { UNLOCK_MODES } from "@/ipc/shared/sequences";

export const listModulesInputSchema = z.object({
  programId: z.string(),
});

export const createModuleInputSchema = z.object({
  name: z.string().min(1),
  programId: z.string(),
});

export const updateModuleInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export const reorderModulesInputSchema = z.object({
  ids: z.array(z.string()),
  programId: z.string(),
});

export const setModuleUnlockRuleInputSchema = z.object({
  id: z.string(),
  mode: z.enum(UNLOCK_MODES),
  requiredIds: z.array(z.string()),
});

export const getModuleUnlockRuleInputSchema = z.object({
  id: z.string(),
});

export const softDeleteModuleInputSchema = z.object({
  id: z.string(),
});
