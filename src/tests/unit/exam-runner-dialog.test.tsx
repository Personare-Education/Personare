import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Exam } from "@/components/exams-data-table";
import "@/localization/i18n";

/**
 * RED phase (docs/specs/exams.md §3): an exam drawn afresh, answered
 * without seeing right or wrong, free to go back, submitted (by hand or
 * when time runs out) to the score result, the attempt saved.
 */

vi.mock("@/actions/exams", () => ({
  drawExam: vi.fn(),
  saveExamAttempt: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/actions/attachments", () => ({
  getAttachmentImageDataUrl: vi.fn(),
}));
vi.mock("@/utils/sounds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/sounds")>()),
  playCorrect: vi.fn(),
  playExamTick: vi.fn(),
  playVictory: vi.fn(),
}));
// Motion drives CountUp from real time; as in quiz-score-result.test.tsx,
// this stand-in shows the final value once started.
vi.mock("@/components/count-up", async () => {
  const { useEffect } = await import("react");
  function CountUpStub({
    format = String,
    onEnd,
    startWhen = true,
    to,
  }: {
    format?: (value: number) => string;
    onEnd?: () => void;
    startWhen?: boolean;
    to: number;
  }) {
    useEffect(() => {
      if (startWhen) {
        const timeoutId = setTimeout(() => onEnd?.(), 10);
        return () => clearTimeout(timeoutId);
      }
    }, [onEnd, startWhen]);
    return <span>{format(startWhen ? to : 0)}</span>;
  }
  return { default: CountUpStub };
});

const { drawExam, saveExamAttempt } = await import("@/actions/exams");
const { playCorrect, playExamTick, playVictory } = await import(
  "@/utils/sounds"
);
const { default: ExamRunnerDialog } = await import(
  "@/components/exam-runner-dialog"
);

const QUESTIONS = [
  {
    id: "q1",
    imagePath: null,
    options: [
      { id: "q1-a", imagePath: null, isCorrect: false, text: "São Paulo" },
      { id: "q1-b", imagePath: null, isCorrect: true, text: "Brasília" },
    ],
    text: "Qual é a capital do Brasil?",
  },
  {
    id: "q2",
    imagePath: null,
    options: [
      { id: "q2-a", imagePath: null, isCorrect: false, text: "3" },
      { id: "q2-b", imagePath: null, isCorrect: true, text: "4" },
    ],
    text: "Quanto é 2 + 2?",
  },
];

const EXAM: Exam = {
  availableCount: 2,
  bestScore: null,
  id: "e1",
  lastAttemptAt: null,
  moduleIds: ["a"],
  passed: false,
  passingScore: 70,
  questionCount: 2,
  standaloneCount: 0,
  timeLimitMinutes: null,
  title: "Prova 1",
};

type User = ReturnType<typeof userEvent.setup>;

function setup() {
  return userEvent.setup({
    advanceTimers: (ms) => vi.advanceTimersByTimeAsync(ms),
  });
}

function renderRunner(exam: Exam = EXAM) {
  const onOpenChange = vi.fn();
  const onSubmitted = vi.fn();
  render(
    <ExamRunnerDialog
      exam={exam}
      onOpenChange={onOpenChange}
      onSubmitted={onSubmitted}
      open
    />
  );
  return { onOpenChange, onSubmitted };
}

function button(key: string) {
  return screen.getByRole("button", { name: i18n.t(key) });
}

async function choose(user: User, option: number) {
  await user.click(
    (screen.getAllByRole("radio") as HTMLInputElement[])[option]
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-06T10:00:00.000Z"));
  await i18n.changeLanguage("pt-BR");
  vi.mocked(drawExam).mockResolvedValue(QUESTIONS);
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

describe("ExamRunnerDialog (exams.md §3)", () => {
  it("draws the questions and shows one at a time (AC-1)", async () => {
    renderRunner();

    expect(await screen.findByText(QUESTIONS[0].text)).toBeVisible();
    expect(drawExam).toHaveBeenCalledWith("e1");
    expect(screen.getByText("Pergunta 1 de 2")).toBeInTheDocument();
  });

  it("never says whether an answer is right (AC-2)", async () => {
    const user = setup();
    renderRunner();
    await screen.findByText(QUESTIONS[0].text);

    await choose(user, 0);

    expect(
      screen.queryByText(i18n.t("quizFeedbackIncorrectMessage"))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t("quizFeedbackCorrectMessage"))
    ).not.toBeInTheDocument();
    expect(document.querySelector("[data-feedback]")).toBeNull();
  });

  it("goes back and forth, and an answer can change until it is submitted (AC-2)", async () => {
    const user = setup();
    renderRunner();
    await screen.findByText(QUESTIONS[0].text);

    expect(button("previousQuestionAction")).toBeDisabled();
    await choose(user, 0);
    await user.click(button("nextQuestionAction"));
    expect(screen.getByText("Pergunta 2 de 2")).toBeInTheDocument();
    await user.click(button("previousQuestionAction"));
    expect(screen.getByText(QUESTIONS[0].text)).toBeVisible();

    await choose(user, 1);
    expect(screen.getAllByRole("radio")[1]).toBeChecked();
  });

  it("asks before submitting with blank questions, which count as wrong (AC-3)", async () => {
    const user = setup();
    const { onSubmitted } = renderRunner();
    await screen.findByText(QUESTIONS[0].text);

    await choose(user, 1);
    await user.click(button("submitExamAction"));

    const confirm = await screen.findByRole("alertdialog");
    expect(
      within(confirm).getByText("Falta 1 pergunta. Entregar assim mesmo?")
    ).toBeInTheDocument();
    await user.click(
      within(confirm).getByRole("button", {
        name: i18n.t("submitExamAction"),
      })
    );

    expect(saveExamAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ correct: 1, examId: "e1", total: 2 })
    );
    expect(onSubmitted).toHaveBeenCalled();
  });

  it("submits right away when everything is answered, and saves the attempt (AC-3, AC-6)", async () => {
    const user = setup();
    renderRunner();
    await screen.findByText(QUESTIONS[0].text);

    await choose(user, 1);
    await user.click(button("nextQuestionAction"));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await choose(user, 1);
    await user.click(button("submitExamAction"));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const [[attempt]] = vi.mocked(saveExamAttempt).mock.calls;
    expect(attempt).toMatchObject({
      correct: 2,
      examId: "e1",
      startedAt: new Date("2026-10-06T10:00:00.000Z"),
      total: 2,
    });
    expect(attempt.durationMs).toBeGreaterThanOrEqual(3000);
  });

  it("shows the score result and whether it passed (AC-6)", async () => {
    const user = setup();
    renderRunner();
    await screen.findByText(QUESTIONS[0].text);

    await choose(user, 1);
    await user.click(button("nextQuestionAction"));
    await choose(user, 0);
    await user.click(button("submitExamAction"));

    expect(
      await screen.findByText(
        i18n.t("quizResultMessage", { correct: 1, total: 2 })
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não aprovada · nota para passar 70%")
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizReviewCorrectAnswerLabel"))
    ).toBeInTheDocument();
  });

  it("says it passed when the share reaches the passing score", async () => {
    const user = setup();
    renderRunner({ ...EXAM, passingScore: 50 });
    await screen.findByText(QUESTIONS[0].text);

    await choose(user, 1);
    await user.click(button("submitExamAction"));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: i18n.t("submitExamAction"),
      })
    );

    expect(
      await screen.findByText("Aprovada · nota para passar 50%")
    ).toBeInTheDocument();
  });

  it("counts the time down and submits when it runs out (AC-4)", async () => {
    const user = setup();
    renderRunner({ ...EXAM, timeLimitMinutes: 1 });
    await screen.findByText(QUESTIONS[0].text);

    expect(screen.getByText("01:00")).toBeInTheDocument();
    await choose(user, 1);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText("00:30")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(31_000));

    expect(saveExamAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ correct: 1, total: 2 })
    );
    expect(
      await screen.findByText(i18n.t("examTimeUpMessage"))
    ).toBeInTheDocument();
  });

  it("shows the time spent when there is no limit (AC-4)", async () => {
    renderRunner();
    await screen.findByText(QUESTIONS[0].text);

    await act(() => vi.advanceTimersByTimeAsync(65_000));

    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("asks before leaving midway, and leaving saves nothing (AC-5)", async () => {
    const user = setup();
    const { onOpenChange } = renderRunner();
    await screen.findByText(QUESTIONS[0].text);

    await user.keyboard("{Escape}");
    const confirm = await screen.findByRole("alertdialog");
    await user.click(
      within(confirm).getByRole("button", {
        name: i18n.t("examLeaveConfirmAction"),
      })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(saveExamAttempt).not.toHaveBeenCalled();
  });

  describe("sounds (gamification.md §2 AC-2)", () => {
    it("stays silent while answering, then ticks once per correct answer and plays the victory on a pass", async () => {
      const user = setup();
      renderRunner({ ...EXAM, passingScore: 50 });
      await screen.findByText(QUESTIONS[0].text);

      await choose(user, 1);
      await user.click(button("nextQuestionAction"));
      await choose(user, 1);
      expect(playCorrect).not.toHaveBeenCalled();
      expect(playExamTick).not.toHaveBeenCalled();

      await user.click(button("submitExamAction"));
      await act(() => vi.advanceTimersByTimeAsync(3000));

      expect(playExamTick).toHaveBeenCalledTimes(2);
      expect(playVictory).toHaveBeenCalledTimes(1);
    });

    it("plays no victory when it did not pass", async () => {
      const user = setup();
      renderRunner({ ...EXAM, passingScore: 100 });
      await screen.findByText(QUESTIONS[0].text);

      await choose(user, 1);
      await user.click(button("submitExamAction"));
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: i18n.t("submitExamAction"),
        })
      );
      await act(() => vi.advanceTimersByTimeAsync(3000));

      expect(playExamTick).toHaveBeenCalledTimes(1);
      expect(playVictory).not.toHaveBeenCalled();
    });
  });
});
