export type ActivityFollowUp = "flashcards" | "quizQuestions";

/**
 * What to open right after an activity is created
 * (docs/specs/flashcard-editor-and-creation-flow.md AC-1..3): a new quiz
 * goes straight to writing its first question, a new deck to its first
 * card. A quiz created through the activity form's submit is always a
 * manual one -- the AI import has its own path.
 */
export function followUpForCreatedActivity(
  type: string
): ActivityFollowUp | null {
  if (type === "quiz") {
    return "quizQuestions";
  }
  if (type === "flashcard_deck") {
    return "flashcards";
  }
  return null;
}
