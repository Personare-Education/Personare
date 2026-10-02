import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { Activity } from "@/components/activities-data-table";

/**
 * RED phase (Issue #14, Spec Driven TDD): src/components/quiz-question-manager-dialog
 * does not exist yet. Every test below is expected to fail until Fundacao
 * (Developer) implements it, per docs/specs/issue-14-quiz.md AC-1.
 *
 * Contract exercised here: given a quiz Activity, lists its existing
 * questions (fetched through listQuizQuestionsWithOptions), with an
 * add-question action and per-row edit/delete actions. Add/edit open the
 * already-implemented QuizQuestionFormDialog (RED phase inherited from a
 * previous session -- src/tests/unit/quiz-question-form-dialog.test.tsx).
 * Submitting the form:
 * - new question: createQuizQuestion(activityId, text), then
 *   createQuizOption(questionId, text, isCorrect) per submitted option.
 * - existing question: updateQuizQuestion(id, text), then reconciles
 *   options via hard delete-and-recreate -- softDeleteQuizOption(id) for
 *   every option that was already loaded for that question, followed by
 *   createQuizOption(questionId, text, isCorrect) per submitted option
 *   (the form's onSubmit does not carry option ids, so the manager owns
 *   this reconciliation, exactly as documented in the spec).
 * Delete calls softDeleteQuizQuestion(id) and refreshes the list.
 */

vi.mock("@/actions/quiz", () => ({
  createQuizOption: vi.fn(),
  createQuizQuestion: vi.fn(),
  listQuizQuestionsWithOptions: vi.fn(),
  restoreQuizQuestion: vi.fn().mockResolvedValue(undefined),
  softDeleteQuizOption: vi.fn(),
  softDeleteQuizQuestion: vi.fn(),
  updateQuizQuestion: vi.fn(),
}));
vi.mock("@/utils/undo-toast", () => ({
  showUndoToast: vi.fn(),
}));

vi.mock("@/actions/dialog", () => ({
  selectImageFile: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  deleteAttachmentImage: vi.fn(),
  getAttachmentImageDataUrl: vi.fn(),
  saveAttachmentImage: vi.fn(),
  saveAttachmentImageData: vi.fn(),
}));

const {
  createQuizOption,
  createQuizQuestion,
  listQuizQuestionsWithOptions,
  softDeleteQuizOption,
  restoreQuizQuestion,
  softDeleteQuizQuestion,
  updateQuizQuestion,
} = await import("@/actions/quiz");
const { showUndoToast } = await import("@/utils/undo-toast");
const { default: QuizQuestionManagerDialog } = await import(
  "@/components/quiz-question-manager-dialog"
);

const QUIZ_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-02"),
  filePath: null,
  id: "22222222-2222-2222-2222-222222222222",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Quiz de fixacao",
  type: "quiz",
  updatedAt: new Date("2026-01-02"),
  url: null,
};

const EXISTING_QUESTIONS = [
  {
    id: "q1",
    imagePath: null,
    options: [
      { id: "o1", imagePath: null, isCorrect: false, text: "Sao Paulo" },
      { id: "o2", imagePath: null, isCorrect: true, text: "Brasilia" },
    ],
    text: "Qual e a capital do Brasil?",
  },
  {
    id: "q2",
    imagePath: null,
    options: [
      { id: "o3", imagePath: null, isCorrect: false, text: "3" },
      { id: "o4", imagePath: null, isCorrect: true, text: "4" },
    ],
    text: "Quanto e 2 + 2?",
  },
];

function editor() {
  return screen.getByRole("textbox", { name: i18n.t("quizComposerLabel") });
}

async function send(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(editor(), `${text}{Shift>}{Enter}{/Shift}`);
}

function renderManager(
  activity: Activity | null = QUIZ_ACTIVITY,
  startWithNewItem = false
) {
  const onOpenChange = vi.fn();

  render(
    <QuizQuestionManagerDialog
      activity={activity}
      onOpenChange={onOpenChange}
      open={activity !== null}
      startWithNewItem={startWithNewItem}
    />
  );

  return { onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listQuizQuestionsWithOptions).mockResolvedValue(EXISTING_QUESTIONS);
});

describe("QuizQuestionManagerDialog (Issue #14)", () => {
  it("does not attempt to load questions when there is no activity", () => {
    renderManager(null);

    expect(listQuizQuestionsWithOptions).not.toHaveBeenCalled();
  });

  it("lists the existing questions' text once loaded", async () => {
    renderManager();

    expect(listQuizQuestionsWithOptions).toHaveBeenCalledWith(QUIZ_ACTIVITY.id);
    expect(
      await screen.findByText(EXISTING_QUESTIONS[0].text)
    ).toBeInTheDocument();
    expect(screen.getByText(EXISTING_QUESTIONS[1].text)).toBeInTheDocument();
  });

  it("renders an empty-state message when the quiz has no questions", async () => {
    vi.mocked(listQuizQuestionsWithOptions).mockResolvedValue([]);

    renderManager();

    expect(
      await screen.findByText(i18n.t("quizQuestionsEmptyMessage"))
    ).toBeInTheDocument();
  });

  it("renders an add-question action, and an edit and a delete action for every question", async () => {
    renderManager();
    await screen.findByText(EXISTING_QUESTIONS[0].text);

    expect(
      screen.getByRole("button", { name: i18n.t("addQuizQuestionAction") })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: i18n.t("editQuizQuestionAction"),
      })
    ).toHaveLength(EXISTING_QUESTIONS.length);
    expect(
      screen.getAllByRole("button", {
        name: i18n.t("deleteQuizQuestionAction"),
      })
    ).toHaveLength(EXISTING_QUESTIONS.length);
  });

  it("calls softDeleteQuizQuestion and refreshes the list when a question's delete action is triggered", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText(EXISTING_QUESTIONS[0].text);

    const deleteButtons = screen.getAllByRole("button", {
      name: i18n.t("deleteQuizQuestionAction"),
    });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(softDeleteQuizQuestion).toHaveBeenCalledWith(
        EXISTING_QUESTIONS[0].id
      );
    });
    await waitFor(() => {
      expect(listQuizQuestionsWithOptions).toHaveBeenCalledTimes(2);
    });
  });

  it("opens the question form, pre-filled, when a question's edit action is triggered", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText(EXISTING_QUESTIONS[0].text);

    const editButtons = screen.getAllByRole("button", {
      name: i18n.t("editQuizQuestionAction"),
    });
    await user.click(editButtons[0]);

    expect(
      screen.getByRole("region", { name: i18n.t("quizHeadingLabel") })
    ).toHaveTextContent(EXISTING_QUESTIONS[0].text);
  });

  it("opens an empty question form when the add-question action is clicked", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText(EXISTING_QUESTIONS[0].text);

    await user.click(
      screen.getByRole("button", { name: i18n.t("addQuizQuestionAction") })
    );

    expect(editor()).toHaveValue("");
    expect(
      screen.queryByRole("region", { name: i18n.t("quizHeadingLabel") })
    ).not.toBeInTheDocument();
  });

  it("opens the new-question form right away when started with a new item", async () => {
    renderManager(QUIZ_ACTIVITY, true);

    expect(
      await screen.findByRole("textbox", { name: i18n.t("quizComposerLabel") })
    ).toHaveValue("");
    expect(
      screen.queryByRole("region", { name: i18n.t("quizHeadingLabel") })
    ).not.toBeInTheDocument();
  });

  it("creates the question and its options, one at a time and in order, when a new question is saved", async () => {
    const user = userEvent.setup();
    vi.mocked(createQuizQuestion).mockResolvedValue({
      activityId: QUIZ_ACTIVITY.id,
      id: "new-q",
      imagePath: null,
      text: "Nova pergunta",
    });
    let pendingOptions = 0;
    let maxPendingOptions = 0;
    vi.mocked(createQuizOption).mockImplementation(() => {
      pendingOptions += 1;
      maxPendingOptions = Math.max(maxPendingOptions, pendingOptions);
      return Promise.resolve().then(() => {
        pendingOptions -= 1;
      }) as never;
    });
    renderManager();
    await screen.findByText(EXISTING_QUESTIONS[0].text);

    await user.click(
      screen.getByRole("button", { name: i18n.t("addQuizQuestionAction") })
    );
    await send(user, "Nova pergunta");
    await send(user, "Opcao A");
    await send(user, "Opcao B");
    await user.click(
      screen.getAllByRole("button", {
        name: i18n.t("markCorrectQuizOptionAction"),
      })[1]
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("concludeQuizEditingAction") })
    );

    await waitFor(() => {
      expect(createQuizQuestion).toHaveBeenCalledWith(
        QUIZ_ACTIVITY.id,
        "Nova pergunta",
        null
      );
    });
    await waitFor(() => {
      expect(vi.mocked(createQuizOption).mock.calls).toEqual([
        ["new-q", "Opcao A", false, null],
        ["new-q", "Opcao B", true, null],
      ]);
    });
    expect(maxPendingOptions).toBe(1);
  });

  it("updates the question and reconciles its options when an existing question is edited", async () => {
    const user = userEvent.setup();
    vi.mocked(updateQuizQuestion).mockResolvedValue({
      activityId: QUIZ_ACTIVITY.id,
      id: "q1",
      imagePath: null,
      text: "Pergunta editada",
    });
    renderManager();
    await screen.findByText(EXISTING_QUESTIONS[0].text);

    const editButtons = screen.getAllByRole("button", {
      name: i18n.t("editQuizQuestionAction"),
    });
    await user.click(editButtons[0]);

    await user.click(
      screen.getByRole("button", { name: i18n.t("editQuizHeadingAction") })
    );
    await user.clear(editor());
    await send(user, "Pergunta editada");
    await user.click(
      screen.getByRole("button", { name: i18n.t("concludeQuizEditingAction") })
    );

    await waitFor(() => {
      expect(updateQuizQuestion).toHaveBeenCalledWith(
        "q1",
        "Pergunta editada",
        null
      );
    });
    await waitFor(() => {
      expect(softDeleteQuizOption).toHaveBeenCalledWith("o1");
      expect(softDeleteQuizOption).toHaveBeenCalledWith("o2");
    });
    await waitFor(() => {
      expect(createQuizOption).toHaveBeenCalledWith(
        "q1",
        "Sao Paulo",
        false,
        null
      );
      expect(createQuizOption).toHaveBeenCalledWith(
        "q1",
        "Brasilia",
        true,
        null
      );
    });
  });

  /** docs/specs/safety-net.md AC-1, AC-2 */
  it("offers to undo a deleted question, bringing it back", async () => {
    const user = userEvent.setup();
    vi.mocked(softDeleteQuizQuestion).mockResolvedValue(undefined);
    renderManager();
    await screen.findByText(EXISTING_QUESTIONS[0].text);

    await user.click(
      screen.getAllByRole("button", {
        name: i18n.t("deleteQuizQuestionAction"),
      })[0]
    );

    await waitFor(() => expect(showUndoToast).toHaveBeenCalledTimes(1));
    const [{ message, onUndo }] = vi.mocked(showUndoToast).mock.calls[0];
    expect(message).toBe(i18n.t("quizQuestionDeletedMessage"));

    onUndo();

    await waitFor(() =>
      expect(restoreQuizQuestion).toHaveBeenCalledWith(EXISTING_QUESTIONS[0].id)
    );
  });
});
