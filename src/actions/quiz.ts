import { ipc } from "@/ipc/manager";
import type { ParsedQuizQuestion } from "@/utils/quiz-markdown";

export function listQuizQuestions(activityId: string) {
  return ipc.client.quiz.listQuestions({ activityId });
}

export function createQuizQuestion(
  activityId: string,
  text: string,
  imagePath: string | null = null
) {
  return ipc.client.quiz.createQuestion({ activityId, imagePath, text });
}

export function updateQuizQuestion(
  id: string,
  text: string,
  imagePath: string | null = null
) {
  return ipc.client.quiz.updateQuestion({ id, imagePath, text });
}

/** Undoes the soft delete (docs/specs/safety-net.md). */
export function restoreQuizQuestion(id: string) {
  return ipc.client.quiz.restoreQuestion({ id });
}

export function softDeleteQuizQuestion(id: string) {
  return ipc.client.quiz.softDeleteQuestion({ id });
}

export function listQuizOptions(questionId: string) {
  return ipc.client.quiz.listOptions({ questionId });
}

export function createQuizOption(
  questionId: string,
  text: string,
  isCorrect: boolean,
  imagePath: string | null = null
) {
  return ipc.client.quiz.createOption({
    imagePath,
    isCorrect,
    questionId,
    text,
  });
}

export function updateQuizOption(
  id: string,
  text: string,
  isCorrect: boolean,
  imagePath: string | null = null
) {
  return ipc.client.quiz.updateOption({ id, imagePath, isCorrect, text });
}

export function softDeleteQuizOption(id: string) {
  return ipc.client.quiz.softDeleteOption({ id });
}

/** A standalone question of an exam (docs/specs/exams.md §1 AC-6). */
export function createExamQuestion(
  examId: string,
  text: string,
  imagePath: string | null = null
) {
  return ipc.client.quiz.createQuestion({ examId, imagePath, text });
}

export function listQuizQuestionsWithOptions(activityId: string) {
  return listQuestionsWithOptions({ activityId });
}

/** An exam's standalone questions, as a quiz's (docs/specs/exams.md §2 AC-4). */
export function listExamQuestionsWithOptions(examId: string) {
  return listQuestionsWithOptions({ examId });
}

async function listQuestionsWithOptions(
  owner: { activityId: string } | { examId: string }
) {
  const questions = await ipc.client.quiz.listQuestions(owner);

  return Promise.all(
    questions.map(async (question) => {
      const options = await ipc.client.quiz.listOptions({
        questionId: question.id,
      });

      return {
        id: question.id,
        imagePath: question.imagePath,
        options: options.map((option) => ({
          id: option.id,
          imagePath: option.imagePath,
          isCorrect: option.isCorrect,
          text: option.text,
        })),
        text: question.text,
      };
    })
  );
}

export function createQuizWithQuestions(
  moduleId: string,
  title: string,
  questions: ParsedQuizQuestion[],
  parentActivityId: string | null = null
) {
  return ipc.client.quiz.createWithQuestions({
    moduleId,
    parentActivityId,
    questions,
    title,
  });
}
