import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { Activity } from "@/components/activities-data-table";

/**
 * RED phase (Issue #16, Spec Driven TDD): src/components/review-session-dialog
 * does not exist yet. Every test below is expected to fail until the
 * Developer implements it, per
 * docs/specs/issue-16-fsrs-review-session.md AC-4. Structurally the closest
 * existing precedent is quiz-runner-dialog.tsx (a dialog that iterates a
 * queue of items fetched on open), but the flow per item differs: instead
 * of picking a multiple-choice option, the user reveals the flashcard's
 * back and then picks one of 4 ratings (again/hard/good/easy).
 *
 * Contract exercised here: on open (activity becomes non-null), calls
 * ensureReviewItems(activity.id) then listDue(activity.id), storing the
 * queue in local state. An empty queue renders the "nothing due" message
 * instead of the review UI. Per item: shows the front; a reveal action
 * shows the back and the 4 rating actions; picking a rating calls
 * submitRating(item.id, rating), removes the item from the LOCAL queue
 * (never re-calls listDue mid-session -- the spec is explicit that the
 * in-memory queue already reflects session progress) and advances to the
 * next item, or shows the "session complete" message once the queue is
 * empty.
 */

vi.mock("@/actions/review", () => ({
  ensureReviewItems: vi.fn(),
  listDue: vi.fn(),
  submitRating: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  getAttachmentImageDataUrl: vi.fn(),
}));

const { ensureReviewItems, listDue, submitRating } = await import(
  "@/actions/review"
);
const { default: ReviewSessionDialog } = await import(
  "@/components/review-session-dialog"
);

const REVIEW_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-02"),
  filePath: null,
  id: "22222222-2222-2222-2222-222222222222",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Baralho de fixacao",
  type: "flashcard_deck",
  updatedAt: new Date("2026-01-02"),
  url: null,
};

const DUE_ITEMS = [
  {
    back: "Capital do Brasil",
    backImagePath: null,
    dueDate: new Date("2026-01-01"),
    front: "Brasilia",
    frontImagePath: "front1.png",
    id: "r1",
  },
  {
    back: "Oceano Atlantico",
    backImagePath: null,
    dueDate: new Date("2026-01-01"),
    front: "Qual oceano banha o Brasil?",
    frontImagePath: null,
    id: "r2",
  },
];

function card() {
  return screen.getByRole("button", { name: i18n.t("flipFlashcardAction") });
}

/** The face the card currently shows (the other one is aria-hidden). */
function visibleFace() {
  return card().querySelector(
    '[data-face]:not([aria-hidden="true"])'
  ) as HTMLElement;
}

function renderSession(activity: Activity | null = REVIEW_ACTIVITY) {
  const onOpenChange = vi.fn();

  render(
    <ReviewSessionDialog
      activity={activity}
      onOpenChange={onOpenChange}
      open={activity !== null}
    />
  );

  return { onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ensureReviewItems).mockResolvedValue(undefined);
  vi.mocked(listDue).mockResolvedValue(DUE_ITEMS);
});

describe("ReviewSessionDialog (Issue #16)", () => {
  it("does not attempt to load review items when there is no activity", () => {
    renderSession(null);

    expect(ensureReviewItems).not.toHaveBeenCalled();
    expect(listDue).not.toHaveBeenCalled();
  });

  it("calls ensureReviewItems and then listDue with the activity id when it opens", async () => {
    renderSession();

    await waitFor(() => {
      expect(listDue).toHaveBeenCalledWith(REVIEW_ACTIVITY.id);
    });
    expect(ensureReviewItems).toHaveBeenCalledWith(REVIEW_ACTIVITY.id);
    expect(
      vi.mocked(ensureReviewItems).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(listDue).mock.invocationCallOrder[0]);
  });

  it("shows the nothing-due message when the queue comes back empty", async () => {
    vi.mocked(listDue).mockResolvedValue([]);

    renderSession();

    expect(
      await screen.findByText(i18n.t("reviewNothingDueMessage"))
    ).toBeInTheDocument();
  });

  it("shows the front of the first due item and a reveal action, without the back, before revealing", async () => {
    renderSession();

    expect(await screen.findByText(DUE_ITEMS[0].front)).toBeInTheDocument();
    expect(screen.queryByText(DUE_ITEMS[0].back)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("revealAnswerAction") })
    ).toBeInTheDocument();
  });

  it("shows a view-image action for the front when it has an attached image", async () => {
    renderSession();

    expect(
      await screen.findByRole("button", { name: i18n.t("viewImageAction") })
    ).toBeInTheDocument();
  });

  it("does not render the rating actions before the answer is revealed", async () => {
    renderSession();
    await screen.findByText(DUE_ITEMS[0].front);

    expect(
      screen.queryByRole("button", { name: i18n.t("ratingGoodAction") })
    ).not.toBeInTheDocument();
  });

  it("reveals the back and renders the four rating actions once the reveal action is clicked", async () => {
    const user = userEvent.setup();
    renderSession();
    await screen.findByText(DUE_ITEMS[0].front);

    await user.click(
      screen.getByRole("button", { name: i18n.t("revealAnswerAction") })
    );

    expect(screen.getByText(DUE_ITEMS[0].back)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("ratingAgainAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("ratingHardAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("ratingGoodAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("ratingEasyAction") })
    ).toBeInTheDocument();
  });

  it("calls submitRating with the item id and rating, then advances to the next item without recalling listDue", async () => {
    const user = userEvent.setup();
    renderSession();
    await screen.findByText(DUE_ITEMS[0].front);
    await user.click(
      screen.getByRole("button", { name: i18n.t("revealAnswerAction") })
    );

    await user.click(
      screen.getByRole("button", { name: i18n.t("ratingGoodAction") })
    );

    expect(submitRating).toHaveBeenCalledWith(DUE_ITEMS[0].id, "good");
    expect(await screen.findByText(DUE_ITEMS[1].front)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("revealAnswerAction") })
    ).toBeInTheDocument();
    expect(listDue).toHaveBeenCalledTimes(1);
  });

  /**
   * docs/specs/flashcard-editor-and-creation-flow.md AC-11..13: the card is
   * the same flipping card as the flashcard editor's.
   */
  it("shows the card on its front, unflipped, before revealing", async () => {
    renderSession();
    await screen.findByText(DUE_ITEMS[0].front);

    expect(card()).toHaveAttribute("aria-pressed", "false");
    expect(visibleFace()).toHaveAttribute("data-face", "front");
  });

  it("flips the card to the back when the answer is revealed", async () => {
    const user = userEvent.setup();
    renderSession();
    await screen.findByText(DUE_ITEMS[0].front);

    await user.click(
      screen.getByRole("button", { name: i18n.t("revealAnswerAction") })
    );

    expect(card()).toHaveAttribute("aria-pressed", "true");
    expect(visibleFace()).toHaveTextContent(DUE_ITEMS[0].back);
  });

  it("reveals the answer when the card itself is clicked", async () => {
    const user = userEvent.setup();
    renderSession();
    await screen.findByText(DUE_ITEMS[0].front);

    await user.click(card());

    expect(visibleFace()).toHaveTextContent(DUE_ITEMS[0].back);
    expect(
      screen.getByRole("button", { name: i18n.t("ratingGoodAction") })
    ).toBeInTheDocument();
  });

  it("shows the next card on its front, without its back, after a rating", async () => {
    const user = userEvent.setup();
    renderSession();
    await screen.findByText(DUE_ITEMS[0].front);
    await user.click(card());

    await user.click(
      screen.getByRole("button", { name: i18n.t("ratingGoodAction") })
    );

    await screen.findByText(DUE_ITEMS[1].front);
    expect(card()).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(DUE_ITEMS[1].back)).not.toBeInTheDocument();
  });

  it("shows the session-complete message after rating the last item in the queue", async () => {
    vi.mocked(listDue).mockResolvedValue([DUE_ITEMS[0]]);
    const user = userEvent.setup();
    renderSession();
    await screen.findByText(DUE_ITEMS[0].front);
    await user.click(
      screen.getByRole("button", { name: i18n.t("revealAnswerAction") })
    );

    await user.click(
      screen.getByRole("button", { name: i18n.t("ratingEasyAction") })
    );

    expect(
      await screen.findByText(i18n.t("reviewSessionCompleteMessage"))
    ).toBeInTheDocument();
  });
});
