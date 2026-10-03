import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import QuizQuestionFormDialog, {
  type QuizQuestionFormValue,
} from "@/components/quiz-question-form-dialog";
import "@/localization/i18n";

vi.mock("@/actions/dialog", () => ({
  selectImageFile: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  deleteAttachmentImage: vi.fn(),
  getAttachmentImageDataUrl: vi.fn(),
  saveAttachmentImage: vi.fn(),
  saveAttachmentImageData: vi.fn(),
}));

/**
 * dnd-kit cannot run a real pointer drag in jsdom, so the real ReUI Sortable
 * is wrapped to capture what it was given: calling its onValueChange is
 * exactly what a finished drag does.
 */
const sortable = vi.hoisted(() => ({
  onValueChange: undefined as ((value: unknown[]) => void) | undefined,
  value: [] as unknown[],
}));
vi.mock("@/components/reui/sortable", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/reui/sortable")>();
  function CapturingSortable<T>(
    props: ComponentProps<typeof actual.Sortable<T>>
  ) {
    sortable.onValueChange = props.onValueChange as (value: unknown[]) => void;
    sortable.value = props.value;
    return <actual.Sortable {...props} />;
  }
  return { ...actual, Sortable: CapturingSortable };
});

const LATEX_PATTERN = /latex/i;

/**
 * RED phase (docs/specs/quiz-question-single-editor.md). The dialog has ONE
 * Markdown editor. The first submission becomes the question's heading, the
 * next ones its alternatives, shown above the editor as a stack of rendered
 * cards. Cards can be edited (their content goes back to the editor) and
 * alternatives reordered by dragging (ReUI's Sortable). "Add question" saves and resets for the
 * next question; "Done" saves and closes. The dialog only closes through
 * "Done" or its X -- not by clicking outside or pressing Escape.
 *
 * Issue #14's rules still hold: a question needs a heading, at least 2
 * alternatives and exactly 1 of them marked as correct -- through each
 * alternative's "mark as correct" button (aria-pressed).
 */

const EXISTING_QUESTION: QuizQuestionFormValue = {
  id: "11111111-1111-1111-1111-111111111111",
  imagePath: null,
  options: [
    {
      id: "aaaaaaaa-0000-0000-0000-000000000001",
      imagePath: null,
      isCorrect: false,
      text: "Sao Paulo",
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000002",
      imagePath: "capital.png",
      isCorrect: true,
      text: "Brasilia",
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000003",
      imagePath: null,
      isCorrect: false,
      text: "Rio de Janeiro",
    },
  ],
  text: "Qual e a capital do Brasil?",
};

function renderDialog(
  question: QuizQuestionFormValue | null = null,
  savedCount?: number
) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  render(
    <QuizQuestionFormDialog
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={true}
      question={question}
      savedCount={savedCount}
    />
  );

  return { onOpenChange, onSubmit };
}

function editor() {
  return screen.getByRole("textbox", {
    name: i18n.t("quizComposerLabel"),
  }) as HTMLTextAreaElement;
}

async function send(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(editor(), `${text}{Shift>}{Enter}{/Shift}`);
}

function heading() {
  return screen.getByRole("region", { name: i18n.t("quizHeadingLabel") });
}

function optionItems() {
  return within(
    screen.getByRole("list", { name: i18n.t("quizOptionsLabel") })
  ).queryAllByRole("listitem");
}

function optionTexts() {
  return optionItems().map((item) => item.textContent ?? "");
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

async function buildValidQuestion(user: ReturnType<typeof userEvent.setup>) {
  await send(user, "Pergunta valida");
  await send(user, "Primeira alternativa");
  await send(user, "Segunda alternativa");
  await user.click(markCorrectButtons()[1]);
}

function markCorrectButtons() {
  return screen.getAllByRole("button", {
    name: i18n.t("markCorrectQuizOptionAction"),
  });
}

describe("QuizQuestionFormDialog -- single editor", () => {
  it("has a single text editor", () => {
    renderDialog(null);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("does not advertise LaTeX support", () => {
    renderDialog(null);

    expect(screen.queryByText(LATEX_PATTERN)).not.toBeInTheDocument();
  });

  it("turns the first submission into the heading and clears the editor", async () => {
    const user = userEvent.setup();
    renderDialog(null);

    await send(user, "Qual e a capital?");

    expect(heading()).toHaveTextContent("Qual e a capital?");
    expect(editor()).toHaveValue("");
    expect(optionItems()).toHaveLength(0);
  });

  it("turns the following submissions into alternatives, in order", async () => {
    const user = userEvent.setup();
    renderDialog(null);

    await send(user, "Pergunta");
    await send(user, "Alfa");
    await user.type(editor(), "Beta");
    await user.click(button(i18n.t("addQuizOptionAction")));

    expect(optionItems()).toHaveLength(2);
    expect(optionTexts()[0]).toContain("Alfa");
    expect(optionTexts()[1]).toContain("Beta");
  });

  it("ignores an empty submission", async () => {
    const user = userEvent.setup();
    renderDialog(null);

    await user.type(editor(), "{Shift>}{Enter}{/Shift}");

    expect(
      screen.queryByRole("region", { name: i18n.t("quizHeadingLabel") })
    ).not.toBeInTheDocument();
  });

  it("loads the heading into the editor on edit and replaces it in place", async () => {
    const user = userEvent.setup();
    renderDialog(null);
    await send(user, "Original");
    await send(user, "Alternativa");

    await user.click(button(i18n.t("editQuizHeadingAction")));
    expect(editor()).toHaveValue("Original");

    await user.clear(editor());
    await send(user, "Editado");

    expect(heading()).toHaveTextContent("Editado");
    expect(optionItems()).toHaveLength(1);
  });

  it("replaces an edited alternative in place and gives back the unsent draft", async () => {
    const user = userEvent.setup();
    renderDialog(EXISTING_QUESTION);
    await user.type(editor(), "rascunho");

    await user.click(
      within(optionItems()[0]).getByRole("button", {
        name: i18n.t("editQuizOptionAction"),
      })
    );
    expect(editor()).toHaveValue("Sao Paulo");

    await user.clear(editor());
    await send(user, "Salvador");

    expect(optionTexts()[0]).toContain("Salvador");
    expect(optionItems()).toHaveLength(3);
    expect(editor()).toHaveValue("rascunho");
  });

  it("pre-fills the heading and alternatives of an existing question", () => {
    renderDialog(EXISTING_QUESTION);

    expect(heading()).toHaveTextContent(EXISTING_QUESTION.text);
    expect(optionItems()).toHaveLength(3);
    expect(
      markCorrectButtons().map((b) => b.getAttribute("aria-pressed"))
    ).toEqual(["false", "true", "false"]);
  });

  it("marks one alternative as correct and unmarks the previous one", async () => {
    const user = userEvent.setup();
    renderDialog(EXISTING_QUESTION);

    await user.click(markCorrectButtons()[2]);

    expect(
      markCorrectButtons().map((b) => b.getAttribute("aria-pressed"))
    ).toEqual(["false", "false", "true"]);
    expect(
      within(optionItems()[2]).getByText(i18n.t("quizReviewCorrectStatusLabel"))
    ).toBeInTheDocument();
  });

  it("removes an alternative", async () => {
    const user = userEvent.setup();
    renderDialog(EXISTING_QUESTION);

    await user.click(
      within(optionItems()[0]).getByRole("button", {
        name: i18n.t("removeQuizOptionAction"),
      })
    );

    expect(optionItems()).toHaveLength(2);
  });

  it("gives every alternative a ReUI sortable drag handle", () => {
    renderDialog(EXISTING_QUESTION);

    for (const item of optionItems()) {
      const handle = within(item).getByRole("button", {
        name: i18n.t("dragQuizOptionAction"),
      });
      expect(handle).toHaveAttribute("data-slot", "sortable-item-handle");
    }
  });

  it("reorders the alternatives when the sortable drops one elsewhere", () => {
    renderDialog(EXISTING_QUESTION);
    const [saoPaulo, brasilia, rio] = sortable.value;

    act(() => {
      sortable.onValueChange?.([rio, saoPaulo, brasilia]);
    });

    expect(optionTexts()[0]).toContain("Rio de Janeiro");
    expect(optionTexts()[1]).toContain("Sao Paulo");
    expect(optionTexts()[2]).toContain("Brasilia");
  });

  it("saves the alternatives in their reordered order", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(EXISTING_QUESTION);
    const [saoPaulo, brasilia, rio] = sortable.value;
    act(() => {
      sortable.onValueChange?.([brasilia, rio, saoPaulo]);
    });

    await user.click(button(i18n.t("concludeQuizEditingAction")));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const options = onSubmit.mock.calls[0][3] as { text: string }[];
    expect(options.map((option) => option.text)).toEqual([
      "Brasilia",
      "Rio de Janeiro",
      "Sao Paulo",
    ]);
  });

  it("does not save without a correct alternative and says why", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(null);
    await send(user, "Pergunta");
    await send(user, "A");
    await send(user, "B");

    await user.click(button(i18n.t("saveAndAddAnotherQuestionAction")));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t("quizFormNoCorrectOptionError"))
    ).toBeInTheDocument();
  });

  it("does not save with fewer than 2 alternatives", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(null);
    await send(user, "Pergunta");
    await send(user, "A");
    await user.click(markCorrectButtons()[0]);

    await user.click(button(i18n.t("saveAndAddAnotherQuestionAction")));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t("quizFormTooFewOptionsError"))
    ).toBeInTheDocument();
  });

  it("saves on 'add question' and resets the form for the next one, still open", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSubmit } = renderDialog(null);
    await buildValidQuestion(user);

    await user.click(button(i18n.t("saveAndAddAnotherQuestionAction")));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(null, "Pergunta valida", null, [
        { imagePath: null, isCorrect: false, text: "Primeira alternativa" },
        { imagePath: null, isCorrect: true, text: "Segunda alternativa" },
      ]);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: i18n.t("quizHeadingLabel") })
      ).not.toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("includes what is still in the editor when saving", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(null);
    await send(user, "Pergunta");
    await send(user, "A");
    await user.click(markCorrectButtons()[0]);
    await user.type(editor(), "B");

    await user.click(button(i18n.t("concludeQuizEditingAction")));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(null, "Pergunta", null, [
        { imagePath: null, isCorrect: true, text: "A" },
        { imagePath: null, isCorrect: false, text: "B" },
      ]);
    });
  });

  it("saves an edited existing question under its id on 'done', then closes", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSubmit } = renderDialog(EXISTING_QUESTION);

    await user.click(button(i18n.t("concludeQuizEditingAction")));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      EXISTING_QUESTION.id,
      EXISTING_QUESTION.text,
      null,
      EXISTING_QUESTION.options.map(({ imagePath, isCorrect, text }) => ({
        imagePath,
        isCorrect,
        text,
      }))
    );
  });

  it("creates (not updates) the questions added after an existing one", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(EXISTING_QUESTION);
    await user.click(button(i18n.t("saveAndAddAnotherQuestionAction")));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: i18n.t("quizHeadingLabel") })
      ).not.toBeInTheDocument();
    });

    await buildValidQuestion(user);
    await user.click(button(i18n.t("concludeQuizEditingAction")));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0]).toBeNull();
  });

  it("closes without saving when 'done' is clicked on an empty form", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSubmit } = renderDialog(null);

    await user.click(button(i18n.t("concludeQuizEditingAction")));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open on Escape", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(null);

    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("still closes from its X button", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(null);

    await user.click(button("Close"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  /** docs/specs/polish.md AC-2 */
  it("keeps adding another item quiet next to Done", () => {
    renderDialog();

    expect(
      screen.getByRole("button", {
        name: i18n.t("saveAndAddAnotherQuestionAction"),
      })
    ).toHaveAttribute("data-variant", "ghost");
    expect(
      screen.getByRole("button", { name: i18n.t("concludeQuizEditingAction") })
    ).toHaveAttribute("data-variant", "default");
  });

  /** docs/specs/clarify-editors.md AC-1 */
  it("says how many questions the quiz already has saved", () => {
    renderDialog(null, 2);

    expect(
      screen.getByText(i18n.t("quizQuestionsSavedCount", { count: 2 }))
    ).toBeInTheDocument();
  });
});
