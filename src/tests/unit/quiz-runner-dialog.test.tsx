import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

/*
 * Motion drives CountUp's spring from real time, which fake timers do not
 * move. This stand-in keeps its contract -- shows `from` until startWhen,
 * then the final value, and calls onEnd `duration` seconds later -- so the
 * tests follow the result screen's steps on the fake clock.
 */
vi.mock("@/components/count-up", async () => {
  const { useEffect } = await import("react");

  function CountUpStub({
    duration = 2,
    format = String,
    from = 0,
    onEnd,
    startWhen = true,
    to,
  }: {
    duration?: number;
    format?: (value: number) => string;
    from?: number;
    onEnd?: () => void;
    startWhen?: boolean;
    to: number;
  }) {
    useEffect(() => {
      if (!startWhen) {
        return;
      }
      const timeoutId = setTimeout(() => onEnd?.(), duration * 1000);
      return () => clearTimeout(timeoutId);
    }, [duration, onEnd, startWhen]);

    return <span>{format(startWhen ? to : from)}</span>;
  }

  return { default: CountUpStub };
});

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

/**
 * How long each count up (score, then each time card) runs, plus a little
 * slack for the chart to mount its center label.
 */
const QUIZ_COUNT_UP_MS = 1600;

const PREVIOUS_ACTION = /previous|anterior/i;

async function waitForCountUps() {
  await act(() => vi.advanceTimersByTimeAsync(QUIZ_COUNT_UP_MS * 2));
}

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

type User = ReturnType<typeof userEvent.setup>;

function checkButton() {
  return screen.getByRole("button", { name: i18n.t("quizCheckAnswerAction") });
}

/** Picks an alternative of the current question and confirms it. */
async function answer(user: User, option: number) {
  await user.click(
    (screen.getAllByRole("radio") as HTMLInputElement[])[option]
  );
  await user.click(checkButton());
}

/** The alternative's box, where its right/wrong mark goes. */
function choiceOf(radio: HTMLElement) {
  return radio.closest("[data-slot='questionnaire-choice']") as HTMLElement;
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

    await answer(user, 0);
    expect(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    expect(screen.getByText(RUNNER_QUESTIONS[1].text)).toBeVisible();

    await answer(user, 0);
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
    await user.click(checkButton());
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
    await user.click(checkButton());
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    await screen.findByText(RUNNER_QUESTIONS[1].text);

    await act(() => vi.advanceTimersByTimeAsync(15_000));
    const q2Radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(q2Radios[1]); // 4 (correct)
    await user.click(checkButton());
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );

    const averageTimeName = i18n.t("quizAverageTimeLabel");
    const totalTimeName = i18n.t("quizTotalTimeLabel");

    // The score counts up with the chart; the time cards wait for it.
    expect(
      screen.getByText(i18n.t("quizScoreMaxLabel", { max: 1000 }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizResultMessage", { correct: 2, total: 2 }))
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("figure", { name: averageTimeName })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("figure", { name: totalTimeName })
    ).not.toBeInTheDocument();

    // Score scale: 0 to 1000. Once it is counted, both time cards come in
    // together and count up.
    await act(() => vi.advanceTimersByTimeAsync(QUIZ_COUNT_UP_MS));
    const averageTimeCard = screen.getByRole("figure", {
      name: averageTimeName,
    });
    const totalTimeCard = screen.getByRole("figure", { name: totalTimeName });

    await waitForCountUps();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(within(averageTimeCard).getByText("10s")).toBeInTheDocument();
    expect(within(totalTimeCard).getByText("20s")).toBeInTheDocument();
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
    await user.click(checkButton());
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    await screen.findByText(RUNNER_QUESTIONS[1].text);
    const q2Radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(q2Radios[1]);
    await user.click(checkButton());
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );
    await waitForCountUps();
    expect(screen.getByText("1000")).toBeInTheDocument();

    expect(onFinished).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onFinished).toHaveBeenCalledWith(QUIZ_ACTIVITY);
  });

  /**
   * A click outside the quiz by mistake must not throw the quiz away: the
   * dialog stays open and shakes softly instead.
   */
  it("stays open and shakes when clicked outside", async () => {
    // jsdom has no Web Animations API. The shake runs through it, apart from
    // the dialog's CSS open animation: swapping that CSS animation for a
    // shake replayed the open animation afterwards, so the dialog blinked.
    let endShake: () => void = () => undefined;
    const animate = vi.fn(() => ({
      finished: new Promise<void>((resolve) => {
        endShake = resolve;
      }),
    }));
    HTMLElement.prototype.animate =
      animate as unknown as HTMLElement["animate"];
    const { onOpenChange } = renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);
    // Radix starts listening for outside clicks a tick after opening.
    await act(() => vi.advanceTimersByTimeAsync(10));

    // user-event refuses to click the body a modal dialog made inert
    // (`pointer-events: none`), so the click's events are fired directly:
    // Radix waits for the click that follows the pointerdown.
    fireEvent.pointerDown(document.body, { button: 0 });
    fireEvent.click(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-shaking");
    expect(animate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog").className).not.toContain("dialog-shake");

    // The mark comes off once the shake is over.
    await act(async () => {
      endShake();
      await Promise.resolve();
    });
    expect(screen.getByRole("dialog")).not.toHaveAttribute("data-shaking");
  });

  it("completes the quiz from the result screen's button, like closing it", async () => {
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
    const { onFinished, onOpenChange } = renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    const q1Radios = screen.getAllByRole("radio") as HTMLInputElement[];
    await user.click(q1Radios[1]);
    await user.click(checkButton());
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    await screen.findByText(RUNNER_QUESTIONS[1].text);
    await answer(user, 1);
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );

    await user.click(
      await screen.findByRole("button", { name: i18n.t("completeQuizAction") })
    );

    expect(onFinished).toHaveBeenCalledWith(QUIZ_ACTIVITY);
    expect(onOpenChange).toHaveBeenCalledWith(false);
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

  describe("per-question review list", () => {
    async function finishWithAnswers(
      user: ReturnType<typeof userEvent.setup>,
      { q1, q2 }: { q1: 0 | 1; q2: 0 | 1 }
    ) {
      await screen.findByText(RUNNER_QUESTIONS[0].text);
      const q1Radios = screen.getAllByRole("radio") as HTMLInputElement[];
      await user.click(q1Radios[q1]);
      await user.click(checkButton());
      await user.click(
        screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
      );
      await screen.findByText(RUNNER_QUESTIONS[1].text);
      await answer(user, q2);
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
  });
});

/**
 * RED phase (docs/specs/safety-net.md AC-5..7): going back a question,
 * flagging an unanswered one, and confirming before abandoning answers.
 */
describe("QuizRunnerDialog safety net", () => {
  function setupUser() {
    return userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
  }

  function radios() {
    return screen.getAllByRole("radio") as HTMLInputElement[];
  }

  it("asks before abandoning a quiz with answers, and stays when told to", async () => {
    const user = setupUser();
    const { onOpenChange } = renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);
    await user.click(radios()[0]);

    await user.click(screen.getByRole("button", { name: "Close" }));

    const confirm = await screen.findByRole("alertdialog", {
      name: i18n.t("quizLeaveTitle"),
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await user.click(
      within(confirm).getByRole("button", {
        name: i18n.t("quizLeaveStayAction"),
      })
    );

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText(RUNNER_QUESTIONS[0].text)).toBeInTheDocument();
  });

  it("leaves when confirmed", async () => {
    const user = setupUser();
    const { onOpenChange } = renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);
    await user.click(radios()[0]);
    await user.keyboard("{Escape}");

    await user.click(
      within(
        await screen.findByRole("alertdialog", {
          name: i18n.t("quizLeaveTitle"),
        })
      ).getByRole("button", { name: i18n.t("quizLeaveConfirmAction") })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes right away when nothing was answered yet", async () => {
    const user = setupUser();
    const { onOpenChange } = renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

/**
 * RED phase (docs/specs/quiz-immediate-feedback.md): each question is
 * confirmed, then says right away whether it was right, with no way back.
 */
describe("QuizRunnerDialog immediate feedback", () => {
  function setupUser() {
    return userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
    });
  }

  it("asks for a choice before it can be confirmed (AC-1)", async () => {
    const user = setupUser();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    expect(checkButton()).toBeDisabled();
    expect(screen.getByText(i18n.t("quizUnansweredHint"))).toBeInTheDocument();

    await user.click(screen.getAllByRole("radio")[0]);

    expect(checkButton()).toBeEnabled();
    expect(
      screen.queryByText(i18n.t("quizUnansweredHint"))
    ).not.toBeInTheDocument();
  });

  it("says a right answer is right, and locks the question (AC-2)", async () => {
    const user = setupUser();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);
    const radios = screen.getAllByRole("radio");

    await answer(user, 1);

    expect(screen.getByRole("status")).toHaveTextContent(
      i18n.t("quizFeedbackCorrectMessage")
    );
    expect(choiceOf(radios[1])).toHaveAttribute("data-feedback", "correct");
    expect(choiceOf(radios[0])).not.toHaveAttribute("data-feedback");
    for (const radio of radios) {
      expect(radio).toBeDisabled();
    }
  });

  it("says a wrong answer is wrong and shows the right one (AC-2)", async () => {
    const user = setupUser();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);
    const radios = screen.getAllByRole("radio");

    await answer(user, 0);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(i18n.t("quizFeedbackIncorrectMessage"));
    expect(status).toHaveTextContent("Brasilia");
    expect(choiceOf(radios[0])).toHaveAttribute("data-feedback", "incorrect");
    expect(choiceOf(radios[1])).toHaveAttribute("data-feedback", "correct");
  });

  it("keeps focus on the button, then puts it on the next question (AC-3)", async () => {
    const user = setupUser();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    await user.click(screen.getAllByRole("radio")[1]);
    const button = checkButton();
    await user.click(button);

    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName(i18n.t("nextQuestionAction"));

    await user.click(button);

    await screen.findByText(RUNNER_QUESTIONS[1].text);
    expect(screen.getAllByRole("radio")[0]).toHaveFocus();
  });

  it("has no way back to an answered question (AC-4)", async () => {
    const user = setupUser();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    await answer(user, 1);
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );

    expect(
      screen.queryByRole("button", { name: PREVIOUS_ACTION })
    ).not.toBeInTheDocument();
  });

  it("scores the confirmed answers (AC-5)", async () => {
    const user = setupUser();
    renderRunner();
    await screen.findByText(RUNNER_QUESTIONS[0].text);

    await answer(user, 0);
    await user.click(
      screen.getByRole("button", { name: i18n.t("nextQuestionAction") })
    );
    await screen.findByText(RUNNER_QUESTIONS[1].text);
    await answer(user, 1);
    await user.click(
      screen.getByRole("button", { name: i18n.t("finishQuizAction") })
    );

    await waitForCountUps();
    expect(
      screen.getByText(i18n.t("quizResultMessage", { correct: 1, total: 2 }))
    ).toBeInTheDocument();
  });
});
