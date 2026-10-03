import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { Activity } from "@/components/activities-data-table";

/**
 * RED phase (Issue #15, then extended by Issue #96, Spec Driven TDD).
 * Flashcards now carry an optional frontImagePath/backImagePath, and
 * createFlashcard/updateFlashcard take a single values object (front, back,
 * frontImagePath, backImagePath) instead of positional (front, back), per
 * docs/specs/issue-96-markdown-latex-imagens.md AC-4. Each row's front/back
 * render through MarkdownContent and get an ImageAttachmentViewer.
 *
 * Contract exercised here: given a flashcard_deck Activity (a "Baralho"),
 * lists its existing flashcards (fetched through listFlashcards), showing
 * BOTH front and back per row -- this is an authoring/management screen,
 * not the review screen, so the user needs to see both sides to proofread
 * content. Renders an add-flashcard action and per-row edit/delete actions.
 * Add/edit open FlashcardFormDialog. Submitting the form calls
 * createFlashcard or updateFlashcard depending on whether a flashcard is
 * being edited, then refreshes the list -- simpler than
 * QuizQuestionManagerDialog since a Flashcard is a flat entity with no
 * sub-entity to reconcile. Delete calls softDeleteFlashcard and refreshes
 * the list. None of this ever reads or writes review_items (Issue #16).
 */

vi.mock("@/actions/flashcards", () => ({
  createFlashcard: vi.fn(),
  listFlashcards: vi.fn(),
  restoreFlashcard: vi.fn().mockResolvedValue(undefined),
  softDeleteFlashcard: vi.fn(),
  updateFlashcard: vi.fn(),
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
  createFlashcard,
  listFlashcards,
  restoreFlashcard,
  softDeleteFlashcard,
  updateFlashcard,
} = await import("@/actions/flashcards");
const { showUndoToast } = await import("@/utils/undo-toast");
const { default: FlashcardManagerDialog } = await import(
  "@/components/flashcard-manager-dialog"
);

const DECK_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-02"),
  filePath: null,
  id: "22222222-2222-2222-2222-222222222222",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Baralho de fixacao",
  type: "flashcard_deck",
  updatedAt: new Date("2026-01-02"),
  url: null,
};

const EXISTING_FLASHCARDS = [
  {
    back: "Capital do Brasil",
    backImagePath: null,
    front: "Brasilia",
    frontImagePath: "front1.png",
    id: "f1",
  },
  {
    back: "Oceano Atlantico",
    backImagePath: null,
    front: "Qual oceano banha o Brasil?",
    frontImagePath: null,
    id: "f2",
  },
];

function renderManager(
  activity: Activity | null = DECK_ACTIVITY,
  startWithNewItem = false
) {
  const onOpenChange = vi.fn();

  render(
    <FlashcardManagerDialog
      activity={activity}
      onOpenChange={onOpenChange}
      open={activity !== null}
      startWithNewItem={startWithNewItem}
    />
  );

  return { onOpenChange };
}

function editor() {
  return screen.getByRole("textbox", {
    name: i18n.t("flashcardComposerLabel"),
  });
}

async function send(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(editor(), `${text}{Shift>}{Enter}{/Shift}`);
}

function visibleFaceText() {
  return (
    screen
      .getByRole("button", { name: i18n.t("flipFlashcardAction") })
      .querySelector('[data-face]:not([aria-hidden="true"])')?.textContent ?? ""
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listFlashcards).mockResolvedValue(EXISTING_FLASHCARDS);
});

describe("FlashcardManagerDialog (Issue #15)", () => {
  it("does not attempt to load flashcards when there is no activity", () => {
    renderManager(null);

    expect(listFlashcards).not.toHaveBeenCalled();
  });

  it("lists the existing flashcards' front and back once loaded", async () => {
    renderManager();

    expect(listFlashcards).toHaveBeenCalledWith(DECK_ACTIVITY.id);
    expect(
      await screen.findByText(EXISTING_FLASHCARDS[0].front)
    ).toBeInTheDocument();
    expect(screen.getByText(EXISTING_FLASHCARDS[0].back)).toBeInTheDocument();
    expect(screen.getByText(EXISTING_FLASHCARDS[1].front)).toBeInTheDocument();
    expect(screen.getByText(EXISTING_FLASHCARDS[1].back)).toBeInTheDocument();
  });

  it("renders a view-image action only for a side that has an attached image", async () => {
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    expect(
      screen.getAllByRole("button", { name: i18n.t("viewImageAction") })
    ).toHaveLength(1);
  });

  it("renders an empty-state message when the deck has no flashcards", async () => {
    vi.mocked(listFlashcards).mockResolvedValue([]);

    renderManager();

    expect(
      await screen.findByText(i18n.t("flashcardsEmptyMessage"))
    ).toBeInTheDocument();
  });

  it("renders an add-flashcard action, and an edit and a delete action for every flashcard", async () => {
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    expect(
      screen.getByRole("button", { name: i18n.t("addFlashcardAction") })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: i18n.t("editFlashcardAction") })
    ).toHaveLength(EXISTING_FLASHCARDS.length);
    expect(
      screen.getAllByRole("button", { name: i18n.t("deleteFlashcardAction") })
    ).toHaveLength(EXISTING_FLASHCARDS.length);
  });

  it("calls softDeleteFlashcard and refreshes the list when a flashcard's delete action is triggered", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    const deleteButtons = screen.getAllByRole("button", {
      name: i18n.t("deleteFlashcardAction"),
    });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(softDeleteFlashcard).toHaveBeenCalledWith(
        EXISTING_FLASHCARDS[0].id
      );
    });
    await waitFor(() => {
      expect(listFlashcards).toHaveBeenCalledTimes(2);
    });
  });

  it("opens the flashcard form, pre-filled, when a flashcard's edit action is triggered", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    const editButtons = screen.getAllByRole("button", {
      name: i18n.t("editFlashcardAction"),
    });
    await user.click(editButtons[0]);

    expect(visibleFaceText()).toContain(EXISTING_FLASHCARDS[0].front);
  });

  it("opens an empty flashcard form when the add-flashcard action is clicked", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    await user.click(
      screen.getByRole("button", { name: i18n.t("addFlashcardAction") })
    );

    expect(editor()).toHaveValue("");
    expect(editor()).not.toBeDisabled();
  });

  it("opens the new-flashcard form right away when started with a new item", async () => {
    renderManager(DECK_ACTIVITY, true);

    expect(
      await screen.findByRole("textbox", {
        name: i18n.t("flashcardComposerLabel"),
      })
    ).toHaveValue("");
  });

  it("creates the flashcard when a new one is saved", async () => {
    const user = userEvent.setup();
    vi.mocked(createFlashcard).mockResolvedValue({
      activityId: DECK_ACTIVITY.id,
      back: "Verso novo",
      backImagePath: null,
      front: "Frente nova",
      frontImagePath: null,
      id: "new-f",
    });
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    await user.click(
      screen.getByRole("button", { name: i18n.t("addFlashcardAction") })
    );
    await send(user, "Frente nova");
    await send(user, "Verso novo");
    await user.click(
      screen.getByRole("button", { name: i18n.t("concludeQuizEditingAction") })
    );

    await waitFor(() => {
      expect(createFlashcard).toHaveBeenCalledWith(DECK_ACTIVITY.id, {
        back: "Verso novo",
        backImagePath: null,
        front: "Frente nova",
        frontImagePath: null,
      });
    });
  });

  it("updates the flashcard when an existing one is edited", async () => {
    const user = userEvent.setup();
    vi.mocked(updateFlashcard).mockResolvedValue({
      activityId: DECK_ACTIVITY.id,
      back: EXISTING_FLASHCARDS[0].back,
      backImagePath: null,
      front: "Frente editada",
      frontImagePath: EXISTING_FLASHCARDS[0].frontImagePath,
      id: "f1",
    });
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    const editButtons = screen.getAllByRole("button", {
      name: i18n.t("editFlashcardAction"),
    });
    await user.click(editButtons[0]);

    await user.click(
      screen.getByRole("button", { name: i18n.t("editFlashcardFrontAction") })
    );
    await user.clear(editor());
    await send(user, "Frente editada");
    await user.click(
      screen.getByRole("button", { name: i18n.t("concludeQuizEditingAction") })
    );

    await waitFor(() => {
      expect(updateFlashcard).toHaveBeenCalledWith("f1", {
        back: EXISTING_FLASHCARDS[0].back,
        backImagePath: EXISTING_FLASHCARDS[0].backImagePath,
        front: "Frente editada",
        frontImagePath: EXISTING_FLASHCARDS[0].frontImagePath,
      });
    });
  });

  /** docs/specs/safety-net.md AC-1, AC-2 */
  it("offers to undo a deleted flashcard, bringing it back", async () => {
    const user = userEvent.setup();
    vi.mocked(softDeleteFlashcard).mockResolvedValue(undefined);
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    await user.click(
      screen.getAllByRole("button", {
        name: i18n.t("deleteFlashcardAction"),
      })[0]
    );

    await waitFor(() => expect(showUndoToast).toHaveBeenCalledTimes(1));
    const [{ message, onUndo }] = vi.mocked(showUndoToast).mock.calls[0];
    expect(message).toBe(i18n.t("flashcardDeletedMessage"));

    onUndo();

    await waitFor(() =>
      expect(restoreFlashcard).toHaveBeenCalledWith(EXISTING_FLASHCARDS[0].id)
    );
    await waitFor(() => expect(listFlashcards).toHaveBeenCalledTimes(3));
  });

  /** docs/specs/clarify-editors.md AC-1 */
  it("tells the card form how many cards the deck has", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText(EXISTING_FLASHCARDS[0].front);

    await user.click(
      screen.getByRole("button", { name: i18n.t("addFlashcardAction") })
    );

    expect(
      await screen.findByText(
        i18n.t("flashcardsSavedCount", { count: EXISTING_FLASHCARDS.length })
      )
    ).toBeInTheDocument();
  });
});
