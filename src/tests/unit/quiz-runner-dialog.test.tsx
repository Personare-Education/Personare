import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { Activity } from "@/components/activities-data-table";

/**
 * RED phase (Issue #95, Spec Driven TDD): src/components/quiz-runner-dialog
 * swaps the hand-rolled RadioGroup for the shadcn/ui Questionnaire
 * primitives, per docs/specs/issue-95-quiz-questionnaire-component.md AC-2,
 * and adds a per-question review list to the result screen (AC-3). The
 * one-question-at-a-time flow, progress label, and next/finish navigation
 * inherited from Issue #93 stay observably the same; only the answer
 * capture mechanism changes (final native form submit + FormData instead of
 * per-click state).
 *
 * Fake timers make startedAt/finishedAt deterministic (the component reads
 * Date.now() when the dialog opens and again when the finish action fires).
 */

vi.mock("@/actions/quiz", () => ({
  listQuizQuestionsWithOptions: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  getAttachmentImageDataUrl: vi.fn(),
}));

const { listQuizQuestionsWithOptions } = await import("@/actions/quiz");
const { getAttachmentImageDataUrl } = await import("@/actions/attachments");
const { default: QuizRunnerDialog } = await import(
  "@/components/quiz-runner-dialog"
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

const RUNNER_QUESTIONS = [
  {
    id: "q1",
    imagePath: "question1.png",
    options: [
      { id: "q1-a", imagePath: null, isCorrect: false, text: "Sao Paulo" },
      {
        id: "q1-b",
        imagePath: "option1b.png",
        isCorrect: true,
        text: "Brasilia",
      },
    ],
    text: "Qual e a capital do Brasil?",
  },
  {
    id: "q2",
    imagePath: null,
    options: [
      { id: "q2-a", imagePath: null, isCorrect: false, text: "3" },
      { id: "q2-b", imagePath: null, isCorrect: true, text: "4" },
    ],
    text: "Quanto e 2 + 2?",
  },
];

function renderRunner(activity: Activity | null = QUIZ_ACTIVITY) {
  const onFinished = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <QuizRunnerDialog
      activity={activity}
      onFinished={onFinished}
      onOpenChange={onOpenChange}
      open={activity !== null}
    />
  );

  return { onFinished, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  vi.mocked(listQuizQuestionsWithOptions).mockResolvedValue(RUNNER_QUESTIONS);
  vi.mocked(getAttachmentImageDataUrl).mockResolvedValue(
    "data:image/png;base64,AAAA"
  );
  // The result screen renders RadialChartStacked (Recharts); see
  // radial-chart-stacked.test.tsx for why this mock is required under jsdom.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    bottom: 300,
    height: 300,
    left: 0,
    right: 300,
    toJSON: () => undefined,
    top: 0,
    width: 300,
    x: 0,
    y: 0,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QuizRunnerDialog (Issue #95)", () => {
  it("does not attempt to load questions when there is no activity", () => {
    renderRunner(null);

    expect(listQuizQuestionsWithOptions).not.toHaveBeenCalled();
  });

  it("renders only the current question, not the others, with a radio option per alternative", async () => {
    renderRunner();

    expect(await screen.findByText(RUNNER_QUESTIONS[0].text)).toBeVisible();
    // Every question is mounted (Questionnaire.Item hides inactive ones via
    // the `hidden` attribute instead of unmounting them), so the other
    // question's text is present but not visible.
    expect(screen.getByText(RUNNER_QUESTIONS[1].text)).not.toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("shows a progress label reflecting the current question position", async () => {
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    expect(
      screen.getByText(
        i18n.t("quizQuestionProgressLabel", { current: 1, total: 2 })
      )
    ).toBeInTheDocument();
  });

  it("renders a view-image action for the question and options that have an attached image", async () => {
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    expect(
      screen.getAllByRole("button", { name: i18n.t("viewImageAction") })
    ).toHaveLength(2);
  });

  it("does not select the option's radio when its view-image action is clicked", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);
    // Captured before clicking: Radix's Dialog marks background content
    // aria-hidden while open, which would hide these from a role query.
    const radios = screen.getAllByRole("radio");

    await user.click(
      screen.getAllByRole("button", { name: i18n.t("viewImageAction") })[1]
    );

    expect(radios[1]).not.toBeChecked();
  });

  it("shows the next-question action before the last question, and the finish action on the last one", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    expect(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    expect(screen.getByText(RUNNER_QUESTIONS[1].text)).toBeVisible();

    expect(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        i18n.t("quizQuestionProgressLabel", { current: 2, total: 2 })
      )
    ).toBeInTheDocument();
  });

  it("advances to the next question, no longer showing the previous one or its options", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    const firstRadios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(firstRadios[1]);
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );

    expect(screen.getByText(RUNNER_QUESTIONS[1].text)).toBeVisible();
    expect(screen.getByText(RUNNER_QUESTIONS[0].text)).not.toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("shows the radial chart result with score, total time, and average time per question on finish", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    await act(() => vi.advanceTimersByTimeAsync(5000));
    const q1Radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(q1Radios[1]); // Brasilia (correct)
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    await screen.findByText(RUNNER_QUESTIONS[1].text);

    await act(() => vi.advanceTimersByTimeAsync(15_000));
    const q2Radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(q2Radios[1]); // 4 (correct)
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );

    // Score scale: 0 to 1000.
    expect(await screen.findByText("1000")).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizScoreMaxLabel", { max: 1000 }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizResultMessage", { correct: 2, total: 2 }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizTotalTimeLabel", { duration: "20s" }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizAverageTimeLabel", { duration: "10s" }))
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  /**
   * RED phase (Issue #103, Spec Driven TDD): QuizRunnerDialog does not
   * expose an `onFinished` prop yet. Every test below is expected to fail
   * until the Developer implements it, per
   * docs/specs/issue-103-pdf-native-open-difficulty-flow.md AC-5.
   */
  it("calls onFinished with the activity when the dialog is closed after finishing the quiz", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    const { onFinished } = renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    const q1Radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(q1Radios[1]);
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    await screen.findByText(RUNNER_QUESTIONS[1].text);
    const q2Radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(q2Radios[1]);
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );
    await screen.findByText("1000");

    expect(onFinished).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onFinished).toHaveBeenCalledWith(QUIZ_ACTIVITY);
  });

  it("does not call onFinished when the dialog is closed before finishing the quiz", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    const { onFinished } = renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onFinished).not.toHaveBeenCalled();
  });

  it("counts an unanswered question as incorrect when the finish action is triggered", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    const q1Radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(q1Radios[1]); // Brasilia (correct)
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    await screen.findByText(RUNNER_QUESTIONS[1].text);
    // q2 left unanswered
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );

    expect(await screen.findByText("500")).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizResultMessage", { correct: 1, total: 2 }))
    ).toBeInTheDocument();
  });

  describe("per-question review list", () => {
    async function finishWithAnswers(
      user: ReturnType<typeof userEvent.setup>,
      { q1, q2 }: { q1: 0 | 1; q2: 0 | 1 | null }
    ) {
      await screen.findByText(RUNNER_QUESTIONS[0].text);
      const q1Radios = screen.getAllByRole("radio") as HTMLInputElement[];
      await user.click(q1Radios[q1]);
      await user.click(
        screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
      );
      await screen.findByText(RUNNER_QUESTIONS[1].text);
      if (q2 !== null) {
        const q2Radios = screen.getAllByRole("radio") as HTMLInputElement[];
        await user.click(q2Radios[q2]);
      }
      await user.click(
        screen.getByRole("button", { name: i18n.t("finishQuizAction") })
      );
    }

    async function findReview() {
      return within(
        await screen.findByRole("region", {
          name: i18n.t("quizReviewHeading"),
        })
      );
    }

    it("shows the review heading, each question's text, and the chosen answer", async () => {
      const user = userEvent.setup({
        advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
      });
      renderRunner();

      await finishWithAnswers(user, { q1: 1, q2: 1 });
      const review = await findReview();

      expect(review.getByText(RUNNER_QUESTIONS[0].text)).toBeInTheDocument();
      expect(review.getByText(RUNNER_QUESTIONS[1].text)).toBeInTheDocument();
      expect(
        review.getAllByText(i18n.t("quizReviewYourAnswerLabel"))
      ).toHaveLength(2);
      expect(review.getByText("Brasilia")).toBeInTheDocument();
      expect(review.getByText("4")).toBeInTheDocument();
    });

    it("marks a correct answer without repeating the correct-answer text", async () => {
      const user = userEvent.setup({
        advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
      });
      renderRunner();

      await finishWithAnswers(user, { q1: 1, q2: 1 });
      const review = await findReview();

      expect(
        review.getAllByRole("img", {
          name: i18n.t("quizReviewCorrectStatusLabel"),
        })
      ).toHaveLength(2);
      expect(
        review.queryByText(i18n.t("quizReviewCorrectAnswerLabel"))
      ).not.toBeInTheDocument();
    });

    it("marks a wrong answer and shows the correct answer text", async () => {
      const user = userEvent.setup({
        advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
      });
      renderRunner();

      await finishWithAnswers(user, { q1: 0, q2: 1 });
      const review = await findReview();

      expect(
        review.getByRole("img", {
          name: i18n.t("quizReviewIncorrectStatusLabel"),
        })
      ).toBeInTheDocument();
      expect(
        review.getAllByText(i18n.t("quizReviewYourAnswerLabel"))
      ).toHaveLength(2);
      expect(review.getByText("Sao Paulo")).toBeInTheDocument();
      expect(
        review.getByText(i18n.t("quizReviewCorrectAnswerLabel"))
      ).toBeInTheDocument();
      expect(review.getByText("Brasilia")).toBeInTheDocument();
    });

    it("shows a no-answer label and the correct answer for a question left unanswered", async () => {
      const user = userEvent.setup({
        advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
      });
      renderRunner();

      await finishWithAnswers(user, { q1: 1, q2: null });
      const review = await findReview();

      expect(
        review.getByText(i18n.t("quizReviewNoAnswerLabel"))
      ).toBeInTheDocument();
      expect(
        review.getByText(i18n.t("quizReviewCorrectAnswerLabel"))
      ).toBeInTheDocument();
      expect(review.getByText("4")).toBeInTheDocument();
    });
  });
});
