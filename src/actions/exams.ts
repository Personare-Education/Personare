import { ipc } from "@/ipc/manager";

/** What the exam form saves (docs/specs/exams.md §2 AC-3). */
export interface ExamFields {
  moduleIds: string[];
  passingScore: number;
  questionCount: number;
  timeLimitMinutes: number | null;
  title: string;
}

export function listExams(programId: string) {
  return ipc.client.exams.list({ programId });
}

/** The program's modules, each with how many quiz questions it has. */
export function listEligibleExamModules(programId: string) {
  return ipc.client.exams.listEligibleModules({ programId });
}

export function createExam(programId: string, fields: ExamFields) {
  return ipc.client.exams.create({ ...fields, programId });
}

export function updateExam(id: string, fields: ExamFields) {
  return ipc.client.exams.update({ ...fields, id });
}

export function softDeleteExam(id: string) {
  return ipc.client.exams.softDelete({ id });
}

/** Undoes the soft delete (docs/specs/safety-net.md). */
export function restoreExam(id: string) {
  return ipc.client.exams.restore({ id });
}
