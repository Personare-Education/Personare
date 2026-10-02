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

export async function listQuizQuestionsWithOptions(activityId: string) {
  const questions = await ipc.client.quiz.listQuestions({ activityId });

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
  questions: ParsedQuizQuestion[]
) {
  return ipc.client.quiz.createWithQuestions({ moduleId, questions, title });
}
