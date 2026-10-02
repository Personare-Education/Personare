import { ipc } from "@/ipc/manager";

export function listActivities(moduleId: string) {
  return ipc.client.activities.list({ moduleId });
}

export function createActivity(
  moduleId: string,
  title: string,
  type: string,
  url: string | null,
  filePath: string | null
) {
  return ipc.client.activities.create({ filePath, moduleId, title, type, url });
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
