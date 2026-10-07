import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listQuizQuestionsWithOptions } from "@/actions/quiz";
import {
  armPendingActivityRating,
  clearPendingActivityRating,
  markActivityDifficulty,
  previewActivityRatings,
} from "@/actions/review";
import type { Activity } from "@/components/activities-data-table";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownContent from "@/components/markdown-content";
import {
  QuizAnswerReview,
  type QuizRunnerOption,
  type QuizRunnerQuestion,
} from "@/components/quiz-answer-review";
import {
  RATING_LABEL_KEYS,
  RatingButtons,
  RatingSaveError,
  type RatingValue,
} from "@/components/rating-buttons";
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
  type QuizAnswers,
  type QuizScore,
  suggestQuizRating,
} from "@/utils/quiz-scoring";
import { playCorrect, playWrong } from "@/utils/sounds";
import { cn } from "@/utils/tailwind";

interface QuizRunnerDialogProps {
  activity: Activity | null;
  /**
   * A step of a sequence (docs/specs/sequences-and-locks.md §5 AC-3): the
   * sequence is rated as a whole, so the result ends on Continue.
   */
  asStep?: boolean;
  /** Finished but closed without rating: the caller asks for the rating. */
  onFinished: (activity: Activity) => void;
  onOpenChange: (open: boolean) => void;
  /** Rated on its result (docs/specs/quiz-result-rating.md AC-3). */
  onRated?: (activity: Activity) => void;
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

// The radio's dot takes the tone too, so a marked choice shows one color.
const CHOICE_FEEDBACK_CLASSES: Record<ChoiceFeedback, string> = {
  correct:
    "data-disabled:opacity-100 border-success/60 bg-success/10 data-checked:border-success/60 data-checked:bg-success/10 [&_[data-slot=questionnaire-choice-indicator]]:!border-success data-checked:[&_[data-slot=questionnaire-choice-indicator]]:!bg-success",
  incorrect:
    "data-disabled:opacity-100 border-destructive/60 bg-destructive/10 data-checked:border-destructive/60 data-checked:bg-destructive/10 [&_[data-slot=questionnaire-choice-indicator]]:!border-destructive data-checked:[&_[data-slot=questionnaire-choice-indicator]]:!bg-destructive",
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

interface QuizRatingResultProps {
  /** The quiz being rated, for each rating's interval. */
  activityId: string | null;
  answers: QuizAnswers;
  isSaving: boolean;
  onRate: (rating: RatingValue) => void;
  questions: QuizRunnerQuestion[];
  result: QuizScore;
  saveFailed: boolean;
}

/**
 * Where a quiz ends (docs/specs/quiz-result-rating.md): the answers beside
 * how many were right, a mark per question, and the activity's ratings,
 * one suggested by the score -- the rating is the decision, so it sits
 * with its evidence. No points, gauge or timers; no card around it.
 */
function QuizRatingResult({
  activityId,
  answers,
  isSaving,
  onRate,
  questions,
  result,
  saveFailed,
}: QuizRatingResultProps) {
  const { t } = useTranslation();
  const [intervals, setIntervals] = useState<
    Partial<Record<RatingValue, Date>> | undefined
  >();
  const suggested = suggestQuizRating(result);

  // What each rating would schedule (docs/specs/rating-clarity.md AC-1).
  useEffect(() => {
    if (activityId) {
      previewActivityRatings(activityId)
        .then(setIntervals)
        .catch(() => undefined);
    }
  }, [activityId]);

  return (
    <div className="grid min-h-0 gap-6 py-4 sm:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex flex-col gap-4 sm:order-last">
        <div className="flex flex-col gap-2">
          <p className="font-medium font-serif text-3xl tracking-[-0.02em]">
            {t("quizResultMessage", {
              correct: result.correct,
              total: result.total,
            })}
          </p>
          {/* One mark per question, in order; the list beside says which. */}
          <div
            aria-hidden="true"
            className="flex flex-wrap gap-1"
            data-testid="quiz-result-marks"
          >
            {questions.map((question) => {
              const chosen = question.options.find(
                (option) => option.id === answers[question.id]
              );
              const mark = chosen?.isCorrect ? "correct" : "incorrect";
              return (
                <span
                  className={cn(
                    "size-3 rounded-[3px]",
                    mark === "correct" ? "bg-success" : "bg-destructive"
                  )}
                  data-mark={mark}
                  key={question.id}
                />
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("quizRatePrompt")}</p>
          <p className="text-foreground/75 text-xs">
            {t("quizRatingSuggestion", {
              rating: t(RATING_LABEL_KEYS.activity[suggested]),
            })}
          </p>
          {saveFailed ? <RatingSaveError /> : null}
          <div className="grid grid-cols-2 gap-2">
            <RatingButtons
              autoFocus
              disabled={isSaving}
              intervals={intervals}
              onRate={onRate}
              scale="activity"
              suggested={suggested}
            />
          </div>
        </div>
      </div>
      <QuizAnswerReview answers={answers} questions={questions} />
    </div>
  );
}

interface QuizStepResultProps {
  answers: QuizAnswers;
  onContinue: () => void;
  questions: QuizRunnerQuestion[];
  result: QuizScore;
}

/** A sequence step's result: how many were right, the answers, Continue. */
function QuizStepResult({
  answers,
  onContinue,
  questions,
  result,
}: QuizStepResultProps) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-0 gap-6 py-4 sm:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex flex-col gap-4 sm:order-last">
        <p className="font-medium font-serif text-3xl tracking-[-0.02em]">
          {t("quizResultMessage", {
            correct: result.correct,
            total: result.total,
          })}
        </p>
        <Button autoFocus className="self-start" onClick={onContinue}>
          {t("continueAction")}
        </Button>
      </div>
      <QuizAnswerReview answers={answers} questions={questions} />
    </div>
  );
}

interface QuizResultProps extends QuizRatingResultProps {
  asStep: boolean;
  onContinue: () => void;
}

/**
 * The end of a quiz: rated here, or -- as a sequence's step -- just
 * Continue (docs/specs/sequences-and-locks.md §5 AC-3).
 */
function QuizResult({ asStep, onContinue, ...props }: QuizResultProps) {
  return asStep ? (
    <QuizStepResult
      answers={props.answers}
      onContinue={onContinue}
      questions={props.questions}
      result={props.result}
    />
  ) : (
    <QuizRatingResult {...props} />
  );
}

export default function QuizRunnerDialog({
  activity,
  asStep = false,
  onFinished,
  onOpenChange,
  onRated,
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
  // One rating in flight; a failed save keeps the result open (AC-4).
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isSavingRef = useRef(false);
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
      setSaveFailed(false);
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
      // Each answer sounds right or wrong (docs/specs/gamification.md §2 AC-1).
      if (
        currentQuestion.options.find((option) => option.id === currentChoice)
          ?.isCorrect
      ) {
        playCorrect();
      } else {
        playWrong();
      }
    }
  }, [currentChoice, currentQuestion]);

  const handleAdvanceClick = useCallback(() => {
    if (!isLastQuestion) {
      focusQuestionIdRef.current = questions.at(currentIndex + 1)?.id ?? null;
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    setResult(calculateQuizScore(questions, answers));
    // Taken but not rated yet: asked again on launch until it is (AC-5).
    if (activity && !asStep) {
      armPendingActivityRating(activity.id);
    }
  }, [activity, answers, asStep, currentIndex, isLastQuestion, questions]);

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

  /**
   * Closing the dialog after the quiz was actually finished (result !==
   * null) without rating it -- via the X button or Escape
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

  const handleRate = useCallback(
    (rating: RatingValue) => {
      if (!activity || isSavingRef.current) {
        return;
      }
      isSavingRef.current = true;
      setIsSaving(true);
      Promise.resolve(markActivityDifficulty(activity.id, rating))
        .then(() => {
          clearPendingActivityRating(activity.id);
          onRated?.(activity);
          onOpenChange(false);
        })
        .catch(() => setSaveFailed(true))
        .finally(() => {
          isSavingRef.current = false;
          setIsSaving(false);
        });
    },
    [activity, onOpenChange, onRated]
  );

  // A step's Continue: the sequence moves on, as closing the result does.
  const handleContinueClick = useCallback(() => {
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
            ? "grid-rows-[auto_minmax(0,1fr)] sm:max-w-3xl"
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
          <QuizResult
            activityId={activity?.id ?? null}
            answers={answers}
            asStep={asStep}
            isSaving={isSaving}
            onContinue={handleContinueClick}
            onRate={handleRate}
            questions={questions}
            result={result}
            saveFailed={saveFailed}
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
