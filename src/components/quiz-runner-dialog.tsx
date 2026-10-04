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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useDialogShake } from "@/hooks/use-dialog-shake";
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
  /** The alternative confirmed for this question, once it is. */
  confirmedOptionId: string | undefined;
  question: QuizRunnerQuestion;
}

type ChoiceFeedback = "correct" | "incorrect";

/**
 * How a confirmed question marks an alternative
 * (docs/specs/quiz-immediate-feedback.md AC-2): the right one, and the
 * chosen one when it was wrong. The rest stay unmarked.
 */
function choiceFeedback(
  option: QuizRunnerOption,
  confirmedOptionId: string | undefined
): ChoiceFeedback | undefined {
  if (confirmedOptionId === undefined) {
    return;
  }
  if (option.isCorrect) {
    return "correct";
  }
  return option.id === confirmedOptionId ? "incorrect" : undefined;
}

const CHOICE_FEEDBACK_CLASSES: Record<ChoiceFeedback, string> = {
  correct:
    "data-disabled:opacity-100 border-success/60 bg-success/10 data-checked:border-success/60 data-checked:bg-success/10",
  incorrect:
    "data-disabled:opacity-100 border-destructive/60 bg-destructive/10 data-checked:border-destructive/60 data-checked:bg-destructive/10",
};

function QuizRunnerQuestionStep({
  confirmedOptionId,
  question,
}: QuizRunnerQuestionStepProps) {
  return (
    <QuestionnaireItem name={question.id}>
      <QuestionnaireTitle className="flex items-center gap-2">
        <MarkdownContent content={question.text} />
        <ImageAttachmentViewer fileName={question.imagePath} />
      </QuestionnaireTitle>
      <QuestionnaireChoices>
        {question.options.map((option) => {
          const feedback = choiceFeedback(option, confirmedOptionId);
          return (
            <div className="flex items-center gap-2" key={option.id}>
              <QuestionnaireChoice
                className={cn(
                  "flex-1",
                  feedback
                    ? CHOICE_FEEDBACK_CLASSES[feedback]
                    : "data-disabled:opacity-60"
                )}
                data-feedback={feedback}
                // Confirmed, the answer is final: the choices lock, but stay
                // shown (docs/specs/quiz-immediate-feedback.md AC-2, AC-4).
                // A disabled item would be skipped and hidden instead.
                disabled={confirmedOptionId !== undefined}
                value={option.id}
              >
                <span className="flex items-start gap-2">
                  <MarkdownContent className="flex-1" content={option.text} />
                  {feedback === "correct" ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-success-text"
                    />
                  ) : null}
                  {feedback === "incorrect" ? (
                    <XCircle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-destructive-text"
                    />
                  ) : null}
                </span>
              </QuestionnaireChoice>
              <ImageAttachmentViewer fileName={option.imagePath} />
            </div>
          );
        })}
      </QuestionnaireChoices>
      <QuizAnswerFeedback
        confirmedOptionId={confirmedOptionId}
        question={question}
      />
    </QuestionnaireItem>
  );
}

interface QuizAnswerFeedbackProps {
  confirmedOptionId: string | undefined;
  question: QuizRunnerQuestion;
}

/**
 * Right or wrong, said as soon as the answer is confirmed, with the right
 * answer when it was wrong (docs/specs/quiz-immediate-feedback.md AC-2). The
 * live region is there before the answer, so screen readers announce it. A
 * future exam mode leaves this out.
 */
function QuizAnswerFeedback({
  confirmedOptionId,
  question,
}: QuizAnswerFeedbackProps) {
  const { t } = useTranslation();
  const correctOption = question.options.find((option) => option.isCorrect);
  const isCorrect = correctOption?.id === confirmedOptionId;

  let content: React.ReactNode = null;
  if (confirmedOptionId !== undefined) {
    content = isCorrect ? (
      <p className="flex items-center gap-2 font-medium text-success-text">
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
        {t("quizFeedbackCorrectMessage")}
      </p>
    ) : (
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 font-medium text-destructive-text">
          <XCircle aria-hidden="true" className="size-4 shrink-0" />
          {t("quizFeedbackIncorrectMessage")}
        </p>
        {correctOption ? (
          <MarkdownContent className="ps-6" content={correctOption.text} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="text-sm" role="status">
      {content}
    </div>
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
  // What is chosen on each question, and what was confirmed: a confirmed
  // answer is final (docs/specs/quiz-immediate-feedback.md AC-2, AC-4).
  const [choices, setChoices] = useState<QuizAnswers>({});
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<QuizScore | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  // Set on "Next question", so the next question's first choice takes focus
  // (AC-3) -- not when the quiz opens, where the dialog places focus.
  const focusQuestionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setChoices({});
      setAnswers({});
      setCurrentIndex(0);
      setResult(null);
      setStartedAt(Date.now());
      setFinishedAt(null);
      setIsConfirmingLeave(false);
    }
  }, [open]);

  const handleChoiceChange = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      const input = event.target as HTMLInputElement;
      if (input.type === "radio" && input.name) {
        setChoices((prev) => ({ ...prev, [input.name]: input.value }));
      }
    },
    []
  );

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
  const currentQuestion = questions[currentIndex] ?? null;
  const currentChoice = currentQuestion
    ? choices[currentQuestion.id]
    : undefined;
  const isCurrentConfirmed =
    currentQuestion !== null && answers[currentQuestion.id] !== undefined;

  const handleCheckClick = useCallback(() => {
    if (currentQuestion && currentChoice) {
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: currentChoice }));
    }
  }, [currentChoice, currentQuestion]);

  const handleAdvanceClick = useCallback(() => {
    if (!isLastQuestion) {
      focusQuestionIdRef.current = questions.at(currentIndex + 1)?.id ?? null;
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    setResult(calculateQuizScore(questions, answers));
    setFinishedAt(Date.now());
  }, [answers, currentIndex, isLastQuestion, questions]);

  // The button the student just pressed turns into "Check answer", still
  // unavailable: focus moves on to the new question's first choice (AC-3).
  useEffect(() => {
    const questionId = focusQuestionIdRef.current;
    if (questionId === null || questions.at(currentIndex)?.id !== questionId) {
      return;
    }
    focusQuestionIdRef.current = null;
    formRef.current
      ?.querySelector<HTMLInputElement>(
        `input[name="${CSS.escape(questionId)}"]`
      )
      ?.focus();
  }, [currentIndex, questions]);
  const totalTimeMs =
    startedAt !== null && finishedAt !== null ? finishedAt - startedAt : 0;
  const averageTimeMs =
    questions.length > 0 ? totalTimeMs / questions.length : 0;

  /**
   * Closing the dialog after the quiz was actually finished (result !==
   * null) -- via the X button, Escape or the result screen's "Complete quiz"
   * button, not just the "Finish quiz" click itself, which only computes the
   * score and shows the result screen -- is the signal to move straight into
   * ActivityDifficultyDialog (Issue #103). Abandoning mid-quiz (no result
   * yet) does not trigger it.
   */
  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      // Abandoning answers asks first (docs/specs/safety-net.md AC-7).
      if (!(nextOpen || result) && Object.keys(choices).length > 0) {
        setIsConfirmingLeave(true);
        return;
      }
      if (!nextOpen && result && activity) {
        onFinished(activity);
      }
      onOpenChange(nextOpen);
    },
    [activity, choices, onFinished, onOpenChange, result]
  );

  const handleLeaveConfirmOpenChange = useCallback((nextOpen: boolean) => {
    setIsConfirmingLeave(nextOpen);
  }, []);

  const handleLeaveClick = useCallback(() => {
    setIsConfirmingLeave(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCompleteClick = useCallback(() => {
    handleDialogOpenChange(false);
  }, [handleDialogOpenChange]);

  // A click outside the quiz is most likely a slip: rather than throwing
  // the quiz away, the dialog stays open and shakes softly.
  const {
    contentRef,
    isShaking,
    preventAndShake: handleInteractOutside,
  } = useDialogShake<HTMLDivElement>();

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={open}>
      <DialogContent
        className={cn(
          "max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)]",
          result
            ? "grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-3xl"
            : "grid-rows-[auto_auto_minmax(0,1fr)_auto]"
        )}
        data-shaking={isShaking || undefined}
        onInteractOutside={handleInteractOutside}
        ref={contentRef}
      >
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
        </DialogHeader>
        {result ? (
          <>
            <QuizRunnerResult
              answers={answers}
              averageTimeMs={averageTimeMs}
              questions={questions}
              result={result}
              totalTimeMs={totalTimeMs}
            />
            <DialogFooter>
              <Button onClick={handleCompleteClick} type="button">
                {t("completeQuizAction")}
              </Button>
            </DialogFooter>
          </>
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
              onChange={handleChoiceChange}
              onItemChange={handleItemChange}
              ref={formRef}
            >
              <div className="flex flex-col gap-4 py-4">
                {questions.map((question) => (
                  <QuizRunnerQuestionStep
                    confirmedOptionId={answers[question.id]}
                    key={question.id}
                    question={question}
                  />
                ))}
              </div>
            </Questionnaire>
            {currentQuestion && !currentChoice ? (
              <p className="text-muted-foreground text-xs">
                {t("quizUnansweredHint")}
              </p>
            ) : null}
            <DialogFooter>
              {/* One button, so focus stays on it from "Check answer" to
                  "Next question" (docs/specs/quiz-immediate-feedback.md AC-3). */}
              {isCurrentConfirmed ? (
                <Button
                  key="advance"
                  onClick={handleAdvanceClick}
                  type="button"
                >
                  {isLastQuestion
                    ? t("finishQuizAction")
                    : t("nextQuestionAction")}
                </Button>
              ) : (
                <Button
                  disabled={!currentChoice}
                  key="advance"
                  onClick={handleCheckClick}
                  type="button"
                >
                  {t("quizCheckAnswerAction")}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
      <AlertDialog
        onOpenChange={handleLeaveConfirmOpenChange}
        open={isConfirmingLeave}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("quizLeaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("quizLeaveDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("quizLeaveStayAction")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveClick}>
              {t("quizLeaveConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
