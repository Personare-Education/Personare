import { CheckCircle2, XCircle } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { listQuizQuestionsWithOptions } from "@/actions/quiz";
import type { Activity } from "@/components/activities-data-table";
import CountUp from "@/components/count-up";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownContent from "@/components/markdown-content";
import { RadialChartStacked } from "@/components/radial-chart-stacked";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Questionnaire,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireItem,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import {
  calculateQuizScore,
  formatQuizDuration,
  type QuizAnswers,
  type QuizScore,
} from "@/utils/quiz-scoring";
import { cn } from "@/utils/tailwind";

interface QuizRunnerOption {
  id: string;
  imagePath: string | null;
  isCorrect: boolean;
  text: string;
}

interface QuizRunnerQuestion {
  id: string;
  imagePath: string | null;
  options: QuizRunnerOption[];
  text: string;
}

interface QuizRunnerDialogProps {
  activity: Activity | null;
  onFinished: (activity: Activity) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface QuizRunnerQuestionStepProps {
  question: QuizRunnerQuestion;
}

function QuizRunnerQuestionStep({ question }: QuizRunnerQuestionStepProps) {
  return (
    <QuestionnaireItem name={question.id}>
      <QuestionnaireTitle className="flex items-center gap-2">
        <MarkdownContent content={question.text} />
        <ImageAttachmentViewer fileName={question.imagePath} />
      </QuestionnaireTitle>
      <QuestionnaireChoices>
        {question.options.map((option) => (
          <div className="flex items-center gap-2" key={option.id}>
            <QuestionnaireChoice className="flex-1" value={option.id}>
              <MarkdownContent content={option.text} />
            </QuestionnaireChoice>
            <ImageAttachmentViewer fileName={option.imagePath} />
          </div>
        ))}
      </QuestionnaireChoices>
    </QuestionnaireItem>
  );
}

interface QuizRunnerReviewRowProps {
  answers: QuizAnswers;
  question: QuizRunnerQuestion;
}

function QuizRunnerReviewRow({ answers, question }: QuizRunnerReviewRowProps) {
  const { t } = useTranslation();
  const selectedOptionId = answers[question.id];
  const selectedOption = question.options.find(
    (option) => option.id === selectedOptionId
  );
  const correctOption = question.options.find((option) => option.isCorrect);
  const isCorrect = selectedOption?.isCorrect ?? false;

  return (
    <li className="flex items-start gap-2 border-b pb-3 text-sm last:border-b-0 last:pb-0">
      {isCorrect ? (
        <CheckCircle2
          aria-label={t("quizReviewCorrectStatusLabel")}
          className="mt-0.5 size-4 shrink-0 text-primary"
          role="img"
        />
      ) : (
        <XCircle
          aria-label={t("quizReviewIncorrectStatusLabel")}
          className="mt-0.5 size-4 shrink-0 text-destructive"
          role="img"
        />
      )}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 font-medium">
          <MarkdownContent content={question.text} />
          <ImageAttachmentViewer fileName={question.imagePath} />
        </div>
        {selectedOption ? (
          <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
            <span>{t("quizReviewYourAnswerLabel")}</span>
            <MarkdownContent content={selectedOption.text} />
          </div>
        ) : (
          <p className="text-muted-foreground">
            {t("quizReviewNoAnswerLabel")}
          </p>
        )}
        {isCorrect || !correctOption ? null : (
          <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
            <span>{t("quizReviewCorrectAnswerLabel")}</span>
            <MarkdownContent content={correctOption.text} />
          </div>
        )}
      </div>
    </li>
  );
}

interface QuizRunnerResultProps {
  answers: QuizAnswers;
  averageTimeMs: number;
  questions: QuizRunnerQuestion[];
  result: QuizScore;
  totalTimeMs: number;
}

const QUIZ_MAX_SCORE = 1000;
const QUIZ_REVIEW_VISIBLE_ROWS = 4;

/**
 * Caps a list's height at the bottom of its Nth row, so at most `rows`
 * rows show and the rest scroll. Rows vary in height (long questions,
 * wrapped answers), so the cap is measured, and re-measured whenever one of
 * those rows resizes. The list must be `relative` so the rows' offsetTop is
 * measured from it.
 */
function useVisibleRowsMaxHeight(
  listRef: RefObject<HTMLElement | null>,
  rows: number
): number | undefined {
  const [maxHeight, setMaxHeight] = useState<number>();

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || list.children.length <= rows) {
      setMaxHeight(undefined);
      return;
    }

    const lastVisibleRow = list.children[rows - 1] as HTMLElement;
    const measure = () =>
      setMaxHeight(lastVisibleRow.offsetTop + lastVisibleRow.offsetHeight);
    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    for (const row of Array.from(list.children).slice(0, rows)) {
      observer.observe(row);
    }
    return () => observer.disconnect();
  }, [listRef, rows]);

  return maxHeight;
}

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

function QuizRunnerResult({
  answers,
  averageTimeMs,
  questions,
  result,
  totalTimeMs,
}: QuizRunnerResultProps) {
  const { t } = useTranslation();
  const reviewHeadingId = useId();
  const reviewListRef = useRef<HTMLOListElement>(null);
  const reviewListMaxHeight = useVisibleRowsMaxHeight(
    reviewListRef,
    QUIZ_REVIEW_VISIBLE_ROWS
  );
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
      <section
        aria-labelledby={reviewHeadingId}
        className="flex min-h-0 flex-col gap-3"
      >
        <h3 className="font-medium text-sm" id={reviewHeadingId}>
          {t("quizReviewHeading")}
        </h3>
        <ol
          className="relative flex min-h-0 flex-col gap-3 overflow-y-auto pr-2 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
          ref={reviewListRef}
          style={{ maxHeight: reviewListMaxHeight }}
        >
          {questions.map((question) => (
            <QuizRunnerReviewRow
              answers={answers}
              key={question.id}
              question={question}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function QuizRunnerDialog({
  activity,
  onFinished,
  onOpenChange,
  open,
}: QuizRunnerDialogProps) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [questions, setQuestions] = useState<QuizRunnerQuestion[]>([]);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<QuizScore | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setAnswers({});
      setCurrentIndex(0);
      setResult(null);
      setStartedAt(Date.now());
      setFinishedAt(null);
    }
  }, [open]);

  useEffect(() => {
    if (activity) {
      listQuizQuestionsWithOptions(activity.id).then(setQuestions);
    }
  }, [activity]);

  const handleItemChange = useCallback(
    (item: string) => {
      const index = questions.findIndex((question) => question.id === item);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    },
    [questions]
  );

  const isLastQuestion =
    questions.length > 0 && currentIndex >= questions.length - 1;

  const handleAdvanceClick = useCallback(() => {
    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    const formElement = formRef.current;
    if (!formElement) {
      return;
    }

    const formData = new FormData(formElement);
    const submittedAnswers: QuizAnswers = {};
    for (const question of questions) {
      submittedAnswers[question.id] = String(formData.get(question.id) ?? "");
    }

    setAnswers(submittedAnswers);
    setResult(calculateQuizScore(questions, submittedAnswers));
    setFinishedAt(Date.now());
  }, [isLastQuestion, questions]);

  const currentQuestion = questions[currentIndex] ?? null;
  const totalTimeMs =
    startedAt !== null && finishedAt !== null ? finishedAt - startedAt : 0;
  const averageTimeMs =
    questions.length > 0 ? totalTimeMs / questions.length : 0;

  /**
   * Closing the dialog after the quiz was actually finished (result !==
   * null) -- via the X button, Escape or an outside click, not just the
   * "Finish quiz" click itself, which only computes the score and shows the
   * result screen -- is the signal to move straight into
   * ActivityDifficultyDialog (Issue #103). Abandoning mid-quiz (no result
   * yet) does not trigger it.
   */
  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && result && activity) {
        onFinished(activity);
      }
      onOpenChange(nextOpen);
    },
    [activity, onFinished, onOpenChange, result]
  );

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={open}>
      <DialogContent
        className={cn(
          "max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)]",
          result
            ? "grid-rows-[auto_minmax(0,1fr)] sm:max-w-3xl"
            : "grid-rows-[auto_auto_minmax(0,1fr)_auto]"
        )}
      >
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
        </DialogHeader>
        {result ? (
          <QuizRunnerResult
            answers={answers}
            averageTimeMs={averageTimeMs}
            questions={questions}
            result={result}
            totalTimeMs={totalTimeMs}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Progress
                value={
                  questions.length > 0
                    ? ((currentIndex + 1) / questions.length) * 100
                    : 0
                }
              />
              <p className="text-muted-foreground text-sm">
                {t("quizQuestionProgressLabel", {
                  current: currentIndex + 1,
                  total: questions.length,
                })}
              </p>
            </div>
            <Questionnaire
              className="min-h-0 overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
              item={currentQuestion?.id}
              items={questions.map((question) => ({
                choices: question.options.map((option) => ({
                  value: option.id,
                })),
                name: question.id,
              }))}
              onItemChange={handleItemChange}
              ref={formRef}
            >
              <div className="flex flex-col gap-4 py-4">
                {questions.map((question) => (
                  <QuizRunnerQuestionStep
                    key={question.id}
                    question={question}
                  />
                ))}
              </div>
            </Questionnaire>
            <DialogFooter>
              <Button onClick={handleAdvanceClick} type="button">
                {isLastQuestion
                  ? t("finishQuizAction")
                  : t("nextQuestionAction")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
