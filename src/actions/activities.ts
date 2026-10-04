import { ipc } from "@/ipc/manager";

/** A module's first level, or -- with a group -- the group's sub-activities. */
export function listActivities(
  moduleId: string,
  parentActivityId: string | null = null
) {
  return ipc.client.activities.list({ moduleId, parentActivityId });
}

export function createActivity(
  moduleId: string,
  title: string,
  type: string,
  url: string | null,
  filePath: string | null,
  parentActivityId: string | null = null
) {
  return ipc.client.activities.create({
    filePath,
    moduleId,
    parentActivityId,
    title,
    type,
    url,
  });
}

export function updateActivity(
  id: string,
  title: string,
  type: string,
  url: string | null,
  filePath: string | null
) {
  return ipc.client.activities.update({ filePath, id, title, type, url });
}

/** Undoes the soft delete (docs/specs/safety-net.md). */
export function restoreActivity(id: string) {
  return ipc.client.activities.restore({ id });
}

export function softDeleteActivity(id: string) {
  return ipc.client.activities.softDelete({ id });
}

/** Saves a module's (or a group's) order (docs/specs/sequences-and-locks.md). */
export function reorderActivities(
  moduleId: string,
  parentActivityId: string | null,
  ids: string[]
) {
  return ipc.client.activities.reorder({ ids, moduleId, parentActivityId });
}

export function setActivityUnlockRule(
  id: string,
  mode: "none" | "previous" | "any" | "all",
  requiredIds: string[]
) {
  return ipc.client.activities.setUnlockRule({ id, mode, requiredIds });
}

/** A sub-activity done inside its group. */
export function completeActivity(id: string) {
  return ipc.client.activities.complete({ id });
}

/** A program's activities, by module: what a rule can require. */
export function listProgramActivities(programId: string) {
  return ipc.client.activities.listByProgram({ programId });
}

export function getActivityUnlockRule(id: string) {
  return ipc.client.activities.getUnlockRule({ id });
}
