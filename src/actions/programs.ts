import { ipc } from "@/ipc/manager";

export interface ProgramActivityCount {
  count: number;
  date: string;
  programId: string;
}

export function listPrograms() {
  return ipc.client.programs.list();
}

export function listProgramActivityCounts() {
  return ipc.client.review.listActivityCounts();
}

export function groupActivityCountsByProgram(
  rows: ProgramActivityCount[]
): Map<string, { count: number; date: string }[]> {
  const grouped = new Map<string, { count: number; date: string }[]>();

  for (const row of rows) {
    const existing = grouped.get(row.programId) ?? [];
    existing.push({ count: row.count, date: row.date });
    grouped.set(row.programId, existing);
  }

  return grouped;
}

export interface ProgramAppearance {
  color: string | null;
  icon: string | null;
}

export function createProgram(name: string, appearance: ProgramAppearance) {
  return ipc.client.programs.create({ ...appearance, name });
}

export function updateProgram(
  id: string,
  name: string,
  appearance: ProgramAppearance
) {
  return ipc.client.programs.update({ ...appearance, id, name });
}

/** Undoes the soft delete (docs/specs/safety-net.md). */
export function restoreProgram(id: string) {
  return ipc.client.programs.restore({ id });
}

export function softDeleteProgram(id: string) {
  return ipc.client.programs.softDelete({ id });
}
