import { act, cleanup, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * docs/specs/quiz-result-rating.md AC-7: the quiz's former result -- the
 * radial chart, the score out of 1000 and the time cards -- stays, as
 * QuizScoreResult, for the future exam ("Prova/Simulado") activity.
 */

vi.mock("@/actions/attachments", () => ({
  getAttachmentImageDataUrl: vi.fn(),
}));
// Motion drives CountUp from real time; this stand-in shows the final value
// once started and calls onEnd right after (see quiz-runner-dialog.test.tsx).
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

const { default: QuizScoreResult } = await import(
  "@/components/quiz-score-result"
);

const QUESTIONS = [
  {
    id: "q1",
    imagePath: null,
    options: [
      { id: "q1-a", imagePath: null, isCorrect: false, text: "Sao Paulo" },
      { id: "q1-b", imagePath: null, isCorrect: true, text: "Brasilia" },
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

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
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
  // Recharts schedules its animation frames on the fake clock; unmount and
  // drop them here, or one fires after jsdom is gone ("cancelAnimationFrame
  // is not defined", an unhandled error that fails the run in CI).
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("QuizScoreResult (kept for the exam type)", () => {
  it("shows the score out of 1000, then the average and total time", async () => {
    render(
      <QuizScoreResult
        answers={{ q1: "q1-b", q2: "q2-b" }}
        averageTimeMs={10_000}
        questions={QUESTIONS}
        result={{ correct: 2, total: 2 }}
        totalTimeMs={20_000}
      />
    );

    expect(
      screen.getByText(i18n.t("quizScoreMaxLabel", { max: 1000 }))
    ).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizResultMessage", { correct: 2, total: 2 }))
    ).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(50));
    const average = screen.getByRole("figure", {
      name: i18n.t("quizAverageTimeLabel"),
    });
    const total = screen.getByRole("figure", {
      name: i18n.t("quizTotalTimeLabel"),
    });
    expect(within(average).getByText("10s")).toBeInTheDocument();
    expect(within(total).getByText("20s")).toBeInTheDocument();
  });

  it("lists the answers", () => {
    render(
      <QuizScoreResult
        answers={{ q1: "q1-a", q2: "q2-b" }}
        averageTimeMs={0}
        questions={QUESTIONS}
        result={{ correct: 1, total: 2 }}
        totalTimeMs={0}
      />
    );

    expect(
      screen.getByRole("region", { name: i18n.t("quizReviewHeading") })
    ).toHaveTextContent("Sao Paulo");
  });
});
