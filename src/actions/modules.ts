import { ipc } from "@/ipc/manager";

export function listModules(programId: string) {
  return ipc.client.modules.list({ programId });
}

export function createModule(programId: string, name: string) {
  return ipc.client.modules.create({ name, programId });
}

export function updateModule(id: string, name: string) {
  return ipc.client.modules.update({ id, name });
}

/** Undoes the soft delete (docs/specs/safety-net.md). */
export function restoreModule(id: string) {
  return ipc.client.modules.restore({ id });
}

export function softDeleteModule(id: string) {
  return ipc.client.modules.softDelete({ id });
}

/** Saves a program's module order (docs/specs/sequences-and-locks.md). */
export function reorderModules(programId: string, ids: string[]) {
  return ipc.client.modules.reorder({ ids, programId });
}

export function setModuleUnlockRule(
  id: string,
  mode: "none" | "previous" | "any" | "all",
  requiredIds: string[]
) {
  return ipc.client.modules.setUnlockRule({ id, mode, requiredIds });
}

export function getModuleUnlockRule(id: string) {
  return ipc.client.modules.getUnlockRule({ id });
}
