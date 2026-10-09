import { ipc } from "@/ipc/manager";
import type { StudyGoal } from "@/utils/study-goal";

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

/** What importing the file would do, writing nothing (docs/specs/program-import.md §3). */
export function previewProgramImport(markdown: string) {
  return ipc.client.programs.previewImport({ markdown });
}

/** Imports a program from Markdown, new or completing one (§2). */
export function importProgram(markdown: string) {
  return ipc.client.programs.import({ markdown });
}

/** Takes away what one import created (§2 AC-6). */
export function undoProgramImport(created: {
  activityIds: string[];
  examIds: string[];
  moduleIds: string[];
  programId: string | null;
}) {
  return ipc.client.programs.undoImport({ created });
}

/** The program's goal (docs/architecture/scheduling.md D1). */
export function setProgramStudyGoal(
  id: string,
  studyGoal: StudyGoal,
  targetDate: string | null
) {
  return ipc.client.programs.setStudyGoal({ id, studyGoal, targetDate });
}
