import { describe, expect, it } from "vitest";
import { followUpForCreatedActivity } from "@/utils/activity-follow-up";

/**
 * RED phase (docs/specs/flashcard-editor-and-creation-flow.md AC-1..3):
 * what the module page opens right after creating an activity. A quiz that
 * reaches the page's onSubmit is always a manual one (the AI import goes
 * through onImportQuiz).
 */
describe("followUpForCreatedActivity", () => {
  it("opens the quiz questions for a new quiz", () => {
    expect(followUpForCreatedActivity("quiz")).toBe("quizQuestions");
  });

  it("opens the flashcards for a new flashcard deck", () => {
    expect(followUpForCreatedActivity("flashcard_deck")).toBe("flashcards");
  });

  it("opens nothing for a link or a PDF", () => {
    expect(followUpForCreatedActivity("link")).toBeNull();
    expect(followUpForCreatedActivity("pdf")).toBeNull();
  });
});

describe("followUpForCreatedActivity, sequences", () => {
  /** docs/specs/sequences-and-locks.md §3 AC-1 */
  it("opens the sequence's manager for a new sequence", () => {
    expect(followUpForCreatedActivity("group")).toBe("sequence");
  });
});
