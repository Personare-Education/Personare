import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import FlashcardFormDialog, {
  type FlashcardFormValue,
} from "@/components/flashcard-form-dialog";
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
 * RED phase (docs/specs/flashcard-editor-and-creation-flow.md AC-4..10).
 * The flashcard dialog works like the quiz question one: ONE Markdown
 * editor, whose first submission is the card's front and the second its
 * back, shown on a card that flips around its vertical axis when clicked.
 * "Add flashcard" saves and resets for the next card; "Done" saves and
 * closes; the dialog only closes through "Done" or its X.
 */

const EXISTING_FLASHCARD: FlashcardFormValue = {
  back: "Capital do Brasil",
  backImagePath: "back123.png",
  front: "Brasilia",
  frontImagePath: null,
  id: "11111111-1111-1111-1111-111111111111",
};

const LATEX_PATTERN = /latex/i;

function renderDialog(flashcard: FlashcardFormValue | null = null) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);

  render(
    <FlashcardFormDialog
      flashcard={flashcard}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={true}
    />
  );

  return { onOpenChange, onSubmit };
}

function editor() {
  return screen.getByRole("textbox", {
    name: i18n.t("flashcardComposerLabel"),
  }) as HTMLTextAreaElement;
}

async function send(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(editor(), `${text}{Shift>}{Enter}{/Shift}`);
}

function card() {
  return screen.getByRole("button", { name: i18n.t("flipFlashcardAction") });
}

/** The face the card currently shows (the other one is aria-hidden). */
function visibleFace() {
  return card().querySelector(
    '[data-face]:not([aria-hidden="true"])'
  ) as HTMLElement;
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

describe("FlashcardFormDialog -- single editor and flipping card", () => {
  it("has a single text editor and does not advertise LaTeX", () => {
    renderDialog(null);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByText(LATEX_PATTERN)).not.toBeInTheDocument();
  });

  it("turns the first submission into the front, shown on the card", async () => {
    const user = userEvent.setup();
    renderDialog(null);

    await send(user, "Qual e a capital?");

    expect(visibleFace()).toHaveAttribute("data-face", "front");
    expect(visibleFace()).toHaveTextContent("Qual e a capital?");
    expect(editor()).toHaveValue("");
  });

  it("turns the second submission into the back and flips the card to show it", async () => {
    const user = userEvent.setup();
    renderDialog(null);

    await send(user, "Pergunta");
    await send(user, "Resposta");

    expect(card()).toHaveAttribute("aria-pressed", "true");
    expect(visibleFace()).toHaveAttribute("data-face", "back");
    expect(visibleFace()).toHaveTextContent("Resposta");
  });

  it("flips the card when it is clicked", async () => {
    const user = userEvent.setup();
    renderDialog(EXISTING_FLASHCARD);
    expect(visibleFace()).toHaveTextContent("Brasilia");

    await user.click(card());

    expect(visibleFace()).toHaveTextContent("Capital do Brasil");

    await user.click(card());

    expect(visibleFace()).toHaveTextContent("Brasilia");
  });

  it("disables the editor once both faces are filled", async () => {
    const user = userEvent.setup();
    renderDialog(null);

    await send(user, "Frente");
    await send(user, "Verso");

    expect(editor()).toBeDisabled();
  });

  it("edits the visible face in place and gives back the unsent draft", async () => {
    const user = userEvent.setup();
    renderDialog(EXISTING_FLASHCARD);
    await user.click(card());

    await user.click(button(i18n.t("editFlashcardBackAction")));
    expect(editor()).toHaveValue("Capital do Brasil");

    await user.clear(editor());
    await send(user, "Capital federal");

    expect(visibleFace()).toHaveTextContent("Capital federal");
    expect(editor()).toHaveValue("");
  });

  it("offers to view the image of the visible face only when it has one", async () => {
    const user = userEvent.setup();
    renderDialog(EXISTING_FLASHCARD);

    expect(
      screen.queryByRole("button", { name: i18n.t("viewImageAction") })
    ).not.toBeInTheDocument();

    await user.click(card());

    expect(button(i18n.t("viewImageAction"))).toBeInTheDocument();
  });

  it("does not save a card without a back and says why", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(null);
    await send(user, "Somente frente");

    await user.click(button(i18n.t("addFlashcardAction")));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t("flashcardFormMissingBackError"))
    ).toBeInTheDocument();
  });

  it("saves on 'add flashcard' and resets for the next card, still open", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSubmit } = renderDialog(null);
    await send(user, "Pergunta nova");
    await user.type(editor(), "Resposta nova");

    await user.click(button(i18n.t("addFlashcardAction")));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(null, {
        back: "Resposta nova",
        backImagePath: null,
        front: "Pergunta nova",
        frontImagePath: null,
      });
    });
    await waitFor(() => expect(editor()).not.toBeDisabled());
    expect(screen.queryByText("Pergunta nova")).not.toBeInTheDocument();
    expect(card()).toHaveAttribute("aria-pressed", "false");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("saves an edited existing card under its id on 'done', then closes", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSubmit } = renderDialog(EXISTING_FLASHCARD);

    await user.click(button(i18n.t("concludeQuizEditingAction")));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSubmit).toHaveBeenCalledWith(EXISTING_FLASHCARD.id, {
      back: EXISTING_FLASHCARD.back,
      backImagePath: EXISTING_FLASHCARD.backImagePath,
      front: EXISTING_FLASHCARD.front,
      frontImagePath: EXISTING_FLASHCARD.frontImagePath,
    });
  });

  it("creates (not updates) the cards added after an existing one", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(EXISTING_FLASHCARD);
    await user.click(button(i18n.t("addFlashcardAction")));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(editor()).not.toBeDisabled());

    await send(user, "Nova frente");
    await send(user, "Novo verso");
    await user.click(button(i18n.t("concludeQuizEditingAction")));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0]).toBeNull();
  });

  it("closes without saving when 'done' is clicked on an empty card", async () => {
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
});
