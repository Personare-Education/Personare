import { useCallback, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import CountUp from "@/components/count-up";
import {
  QuizAnswerReview,
  type QuizRunnerQuestion,
} from "@/components/quiz-answer-review";
import { RadialChartStacked } from "@/components/radial-chart-stacked";
import {
  formatQuizDuration,
  type QuizAnswers,
  type QuizScore,
} from "@/utils/quiz-scoring";
import { cn } from "@/utils/tailwind";

interface QuizScoreResultProps {
  answers: QuizAnswers;
  averageTimeMs: number;
  questions: QuizRunnerQuestion[];
  result: QuizScore;
  totalTimeMs: number;
}

const QUIZ_MAX_SCORE = 1000;

/**
 * The result screen animates in two steps: the score counts up while the
 * chart fills, then both time cards fade in and count up together.
 */
const QUIZ_COUNT_UP_SECONDS = 1.5;

function formatCountedDuration(seconds: number): string {
  return formatQuizDuration(seconds * 1000);
}

interface QuizRunnerTimeCardProps {
  durationMs: number;
  label: string;
  shown: boolean;
}

function QuizRunnerTimeCard({
  durationMs,
  label,
  shown,
}: QuizRunnerTimeCardProps) {
  const labelId = useId();

  return (
    <figure
      aria-hidden={!shown}
      aria-labelledby={labelId}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center",
        shown ? "fade-in-0 animate-in duration-500" : "invisible"
      )}
    >
      <CountUp
        className="font-bold text-2xl tabular-nums"
        duration={QUIZ_COUNT_UP_SECONDS}
        format={formatCountedDuration}
        startWhen={shown}
        to={Math.round(durationMs / 1000)}
      />
      <figcaption className="text-muted-foreground text-xs" id={labelId}>
        {label}
      </figcaption>
    </figure>
  );
}

/**
 * The quiz's former result -- a radial chart of right and wrong, the score
 * out of 1000 and the average and total time -- kept as it was for the
 * future exam ("Prova/Simulado") activity, which will show it on the
 * program's screen (docs/specs/quiz-result-rating.md AC-7). The quiz itself
 * now ends on a rating step instead.
 */
export default function QuizScoreResult({
  answers,
  averageTimeMs,
  questions,
  result,
  totalTimeMs,
}: QuizScoreResultProps) {
  const { t } = useTranslation();
  const score =
    result.total === 0
      ? 0
      : Math.round((result.correct / result.total) * QUIZ_MAX_SCORE);
  const [timesShown, setTimesShown] = useState(false);
  const handleScoreCounted = useCallback(() => setTimesShown(true), []);

  return (
    <div className="grid min-h-0 gap-6 py-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="flex flex-col items-center gap-4 sm:order-last">
        <RadialChartStacked
          animationDuration={QUIZ_COUNT_UP_SECONDS * 1000}
          centerLabel={
            <CountUp
              duration={QUIZ_COUNT_UP_SECONDS}
              onEnd={handleScoreCounted}
              to={score}
            />
          }
          centerSublabel={t("quizScoreMaxLabel", { max: QUIZ_MAX_SCORE })}
          segments={[
            {
              color: "var(--success)",
              key: "correct",
              label: t("quizReviewCorrectStatusLabel"),
              value: result.correct,
            },
            {
              color: "var(--destructive)",
              key: "incorrect",
              label: t("quizReviewIncorrectStatusLabel"),
              value: result.total - result.correct,
            },
          ]}
        />
        <p className="text-muted-foreground text-sm">
          {t("quizResultMessage", {
            correct: result.correct,
            total: result.total,
          })}
        </p>
        <div className="grid w-full grid-cols-2 gap-2">
          <QuizRunnerTimeCard
            durationMs={averageTimeMs}
            label={t("quizAverageTimeLabel")}
            shown={timesShown}
          />
          <QuizRunnerTimeCard
            durationMs={totalTimeMs}
            label={t("quizTotalTimeLabel")}
            shown={timesShown}
          />
        </div>
      </div>
      <QuizAnswerReview answers={answers} questions={questions} />
    </div>
  );
}
