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

/** An attempt's questions, drawn afresh (docs/specs/exams.md §1 AC-8). */
export function drawExam(examId: string) {
  return ipc.client.exams.draw({ examId });
}

export interface ExamAttemptInput {
  correct: number;
  durationMs: number;
  examId: string;
  startedAt: Date;
  total: number;
}

/** Saves a submitted attempt (docs/specs/exams.md §3 AC-6). */
export function saveExamAttempt(attempt: ExamAttemptInput) {
  return ipc.client.exams.saveAttempt(attempt);
}

/** Newest first (docs/specs/exams.md §3 AC-7). */
export function listExamAttempts(examId: string) {
  return ipc.client.exams.listAttempts({ examId });
}
