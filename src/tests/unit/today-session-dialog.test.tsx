import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { TodayItem } from "@/utils/today-queue";

/**
 * RED phase (docs/specs/today-review-queue.md AC-5..7): the "Start"
 * session walks the day's items one at a time -- a deck through its flashcard
 * review, a PDF/link opened and then rated in place, a quiz taken and then
 * rated -- with progress and Skip. Every rating is saved as it happens.
 */

vi.mock("@/actions/review", () => ({
  ensureReviewItems: vi.fn().mockResolvedValue(undefined),
  listDue: vi.fn(),
  markActivityDifficulty: vi.fn().mockResolvedValue({}),
  previewActivityRatings: vi.fn().mockResolvedValue({}),
  previewItemRatings: vi.fn().mockResolvedValue({}),
  submitRating: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/actions/shell", () => ({
  openActivityFile: vi.fn().mockResolvedValue({ errorMessage: "" }),
  openExternalLink: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/actions/attachments", () => ({
  getAttachmentImageDataUrl: vi.fn(),
}));
// The real quiz runner loads its questions over IPC; this stand-in lets the
// test finish the quiz the way the runner reports it.
vi.mock("@/components/quiz-runner-dialog", () => ({
  default: ({
    activity,
    onFinished,
    onRated,
    open,
  }: {
    activity: { id: string } | null;
    onFinished: (activity: { id: string }) => void;
    onRated?: (activity: { id: string }) => void;
    open: boolean;
  }) =>
    open && activity ? (
      <>
        {/* biome-ignore lint/performance/noJsxPropsBind: a test stand-in. */}
        <button onClick={() => onFinished(activity)} type="button">
          quiz-runner-finish
        </button>
        {/* biome-ignore lint/performance/noJsxPropsBind: a test stand-in. */}
        <button onClick={() => onRated?.(activity)} type="button">
          quiz-runner-rate
        </button>
      </>
    ) : null,
}));

const { listDue, markActivityDifficulty, submitRating } = await import(
  "@/actions/review"
);
const { openActivityFile, openExternalLink } = await import("@/actions/shell");
const { default: TodaySessionDialog } = await import(
  "@/components/today-session-dialog"
);

function item(overrides: Partial<TodayItem>): TodayItem {
  return {
    activityFilePath: null,
    activityId: "a",
    activityTitle: "Atividade",
    activityType: "pdf",
    activityUrl: null,
    cardCount: 0,
    moduleId: "m",
    moduleName: "Derivadas",
    overdueDays: 0,
    programColor: "#3b82f6",
    programId: "p",
    programName: "Cálculo I",
    urgency: "today",
    ...overrides,
  };
}

const PDF = item({
  activityFilePath: "C:/aulas/derivadas.pdf",
  activityId: "pdf",
  activityTitle: "Capítulo 3",
  activityType: "pdf",
});
const LINK = item({
  activityId: "link",
  activityTitle: "Aula gravada",
  activityType: "link",
  activityUrl: "https://example.com/aula",
});
const QUIZ = item({
  activityId: "quiz",
  activityTitle: "Quiz de derivadas",
  activityType: "quiz",
});
const DECK = item({
  activityId: "deck",
  activityTitle: "Derivadas básicas",
  activityType: "flashcard_deck",
  cardCount: 1,
});

function renderSession(items: TodayItem[], closeWhenDone = false) {
  const onOpenChange = vi.fn();
  render(
    <TodaySessionDialog
      closeWhenDone={closeWhenDone}
      items={items}
      onOpenChange={onOpenChange}
      open
    />
  );
  return { onOpenChange };
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listDue).mockResolvedValue([
    {
      back: "cos x",
      backImagePath: null,
      dueDate: new Date(),
      front: "Derivada de sin x?",
      frontImagePath: null,
      id: "card-1",
    },
  ]);
});

describe("TodaySessionDialog", () => {
  /** docs/specs/clarify-daily-count.md AC-3 */
  it("moves the progress bar with the position it shows", () => {
    renderSession([PDF, LINK]);

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
  });

  it("shows the progress and the current item", () => {
    renderSession([PDF, LINK]);

    expect(
      screen.getByText(i18n.t("todaySessionProgress", { current: 1, total: 2 }))
    ).toBeInTheDocument();
    expect(screen.getByText(PDF.activityTitle)).toBeInTheDocument();
  });

  it("opens a PDF, then rates it in place and moves on", async () => {
    const user = userEvent.setup();
    renderSession([PDF, LINK]);

    await user.click(button(i18n.t("todayOpenPdfAction")));
    expect(openActivityFile).toHaveBeenCalledWith(PDF.activityFilePath);

    await user.click(button(i18n.t("activityRatingGoodAction")));

    expect(markActivityDifficulty).toHaveBeenCalledWith("pdf", "good");
    expect(await screen.findByText(LINK.activityTitle)).toBeInTheDocument();
  });

  it("opens a link in the browser, then rates it", async () => {
    const user = userEvent.setup();
    renderSession([LINK]);

    await user.click(button(i18n.t("todayOpenLinkAction")));
    expect(openExternalLink).toHaveBeenCalledWith(LINK.activityUrl);

    await user.click(button(i18n.t("activityRatingHardAction")));
    expect(markActivityDifficulty).toHaveBeenCalledWith("link", "hard");
  });

  it("rates an opened activity with the number keys too", async () => {
    const user = userEvent.setup();
    renderSession([PDF]);
    await user.click(button(i18n.t("todayOpenPdfAction")));

    await user.keyboard("4");

    expect(markActivityDifficulty).toHaveBeenCalledWith("pdf", "easy");
  });

  it("takes a quiz, then rates it", async () => {
    const user = userEvent.setup();
    renderSession([QUIZ]);

    await user.click(button(i18n.t("takeQuizAction")));
    await user.click(button("quiz-runner-finish"));
    await user.click(button(i18n.t("activityRatingAgainAction")));

    expect(markActivityDifficulty).toHaveBeenCalledWith("quiz", "again");
  });

  /** docs/specs/quiz-result-rating.md AC-3 */
  it("moves on when the quiz was rated on its own result", async () => {
    const user = userEvent.setup();
    renderSession([QUIZ, PDF]);

    await user.click(button(i18n.t("takeQuizAction")));
    await user.click(button("quiz-runner-rate"));

    expect(await screen.findByText(PDF.activityTitle)).toBeInTheDocument();
    expect(markActivityDifficulty).not.toHaveBeenCalled();
  });

  it("reviews a deck's due cards in place, then moves on", async () => {
    const user = userEvent.setup();
    renderSession([DECK, PDF]);

    await screen.findByText("Derivada de sin x?");
    await user.click(button(i18n.t("revealAnswerAction")));
    await user.click(button(i18n.t("ratingGoodAction")));

    expect(submitRating).toHaveBeenCalledWith("card-1", "good");
    expect(await screen.findByText(PDF.activityTitle)).toBeInTheDocument();
  });

  it("skips an item without rating it", async () => {
    const user = userEvent.setup();
    renderSession([PDF, LINK]);

    await user.click(button(i18n.t("todaySkipAction")));

    expect(markActivityDifficulty).not.toHaveBeenCalled();
    expect(screen.getByText(LINK.activityTitle)).toBeInTheDocument();
  });

  /** docs/specs/day-done-peak.md AC-1 */
  it("closes straight onto the day when it covered the whole day", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderSession([PDF], true);
    await user.click(button(i18n.t("todayOpenPdfAction")));

    await user.click(button(i18n.t("activityRatingGoodAction")));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(
      screen.queryByText(i18n.t("todaySessionDoneTitle"))
    ).not.toBeInTheDocument();
  });

  it("ends with a summary of what was reviewed", async () => {
    const user = userEvent.setup();
    renderSession([PDF, LINK]);
    await user.click(button(i18n.t("todayOpenPdfAction")));
    await user.click(button(i18n.t("activityRatingGoodAction")));
    await screen.findByText(LINK.activityTitle);
    await user.click(button(i18n.t("todaySkipAction")));

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t("todaySessionDoneMessage", { count: 1 }))
      ).toBeInTheDocument();
    });
  });

  /** docs/specs/bolder-cards.md AC-2 */
  it("ends on a brand card that lists what was reviewed by program", async () => {
    const user = userEvent.setup();
    const otherProgramLink = {
      ...LINK,
      programId: "q",
      programName: "Anatomia",
    };
    renderSession([PDF, otherProgramLink]);
    await user.click(button(i18n.t("todayOpenPdfAction")));
    await user.click(button(i18n.t("activityRatingGoodAction")));
    await screen.findByText(LINK.activityTitle);
    await user.click(button(i18n.t("todaySkipAction")));

    const title = await screen.findByRole("heading", {
      name: i18n.t("todaySessionDoneTitle"),
    });
    const card = title.closest<HTMLElement>("[data-slot='session-end-card']");
    expect(card?.style.backgroundImage).toContain("var(--brand)");

    const summary = screen.getByRole("list", {
      name: i18n.t("todaySessionByProgramLabel"),
    });
    const rows = within(summary).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(PDF.programName);
    expect(rows[0]).toHaveTextContent(
      i18n.t("todaySessionProgramCount", { count: 1 })
    );
  });

  /** docs/specs/review-focus-errors.md AC-2 */
  it("moves focus to the middle rating once an activity is opened", async () => {
    const user = userEvent.setup();
    renderSession([PDF]);

    await user.click(button(i18n.t("todayOpenPdfAction")));

    expect(button(i18n.t("activityRatingGoodAction"))).toHaveFocus();
  });

  /** docs/specs/review-focus-errors.md AC-3 */
  it("stays on the activity and says so when its rating fails to save", async () => {
    const user = userEvent.setup();
    vi.mocked(markActivityDifficulty).mockRejectedValueOnce(new Error("x"));
    renderSession([PDF, LINK]);
    await user.click(button(i18n.t("todayOpenPdfAction")));

    await user.click(button(i18n.t("activityRatingGoodAction")));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("ratingSaveErrorMessage")
    );
    expect(screen.getByText(PDF.activityTitle)).toBeInTheDocument();

    await user.click(button(i18n.t("activityRatingGoodAction")));

    expect(await screen.findByText(LINK.activityTitle)).toBeInTheDocument();
  });
});
