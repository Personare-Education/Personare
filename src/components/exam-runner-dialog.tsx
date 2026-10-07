import { CheckCircle2, Timer, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { drawExam, saveExamAttempt } from "@/actions/exams";
import type { Exam } from "@/components/exams-data-table";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownContent from "@/components/markdown-content";
import type { QuizRunnerQuestion } from "@/components/quiz-answer-review";
import QuizScoreResult from "@/components/quiz-score-result";
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
} from "@/utils/quiz-scoring";
import { cn } from "@/utils/tailwind";

interface ExamRunnerDialogProps {
  exam: Exam | null;
  onOpenChange: (open: boolean) => void;
  /** After an attempt is saved, so the list and the locks refresh. */
  onSubmitted?: () => void;
  open: boolean;
}

interface ExamResult {
  durationMs: number;
  score: QuizScore;
  /** Submitted by the clock rather than by hand (AC-4). */
  timedOut: boolean;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

/** "05:07": minutes and seconds, as a clock shows them. */
function formatClock(milliseconds: number, roundUp: boolean): string {
  const seconds = Math.max(
    0,
    roundUp
      ? Math.ceil(milliseconds / SECOND_MS)
      : Math.floor(milliseconds / SECOND_MS)
  );
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

interface ExamClockProps {
  elapsedMs: number;
  limitMs: number | null;
}

/**
 * The time left, or with no limit the time spent (docs/specs/exams.md §3
 * AC-4). Screen readers hear the time left once a minute, and when the last
 * minute starts -- not every second.
 */
function ExamClock({ elapsedMs, limitMs }: ExamClockProps) {
  const { t } = useTranslation();
  const remainingMs = limitMs === null ? null : limitMs - elapsedMs;
  let announcement = "";
  if (remainingMs !== null) {
    const minutesLeft = Math.ceil(remainingMs / MINUTE_MS);
    announcement =
      minutesLeft <= 1
        ? t("examTimeLastMinute")
        : t("examTimeLeftAnnouncement", { count: minutesLeft });
  }

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
      <Timer aria-hidden="true" className="size-4" />
      <span className="sr-only">
        {remainingMs === null
          ? t("examTimeSpentLabel")
          : t("examTimeLeftLabel")}
      </span>
      <span
        className={cn(
          "font-medium tabular-nums",
          remainingMs !== null &&
            remainingMs <= MINUTE_MS &&
            "text-destructive-text"
        )}
      >
        {remainingMs === null
          ? formatClock(elapsedMs, false)
          : formatClock(remainingMs, true)}
      </span>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}

interface ExamQuestionProps {
  question: QuizRunnerQuestion;
}

/** A question with its choices; choosing never says right or wrong (AC-2). */
function ExamQuestion({ question }: ExamQuestionProps) {
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
              <MarkdownContent className="flex-1" content={option.text} />
            </QuestionnaireChoice>
            <ImageAttachmentViewer fileName={option.imagePath} />
          </div>
        ))}
      </QuestionnaireChoices>
    </QuestionnaireItem>
  );
}

interface ExamPassLineProps {
  passingScore: number;
  result: ExamResult;
}

/** Whether the attempt passed, and the score that passes (AC-6). */
function ExamPassLine({ passingScore, result }: ExamPassLineProps) {
  const { t } = useTranslation();
  const { correct, total } = result.score;
  const passed = total > 0 && (correct / total) * 100 >= passingScore;

  return (
    <div className="flex flex-col gap-1">
      {result.timedOut ? (
        <p className="text-muted-foreground text-sm">
          {t("examTimeUpMessage")}
        </p>
      ) : null}
      <p
        className={cn(
          "flex items-center gap-2 font-medium",
          passed ? "text-success-text" : "text-destructive-text"
        )}
      >
        {passed ? (
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <XCircle aria-hidden="true" className="size-4 shrink-0" />
        )}
        {passed
          ? t("examPassedResult", { score: passingScore })
          : t("examFailedResult", { score: passingScore })}
      </p>
    </div>
  );
}

/**
 * Taking an exam (docs/specs/exams.md §3): questions drawn afresh, one at a
 * time, with no right or wrong until the end; free to go back and change an
 * answer; submitted by hand or when the time runs out, then the score
 * result, and the attempt is saved.
 */
export default function ExamRunnerDialog({
  exam,
  onOpenChange,
  onSubmitted,
  open,
}: ExamRunnerDialogProps) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<QuizRunnerQuestion[]>([]);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<ExamResult | null>(null);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  const submittedRef = useRef(false);

  // A fresh draw each time it opens (AC-1).
  useEffect(() => {
    if (!(open && exam)) {
      return;
    }
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setStartedAt(null);
    setIsConfirmingSubmit(false);
    setIsConfirmingLeave(false);
    submittedRef.current = false;
    let cancelled = false;
    drawExam(exam.id).then((drawn) => {
      if (cancelled) {
        return;
      }
      setQuestions(drawn);
      const start = Date.now();
      setStartedAt(start);
      setNow(start);
    });
    return () => {
      cancelled = true;
    };
  }, [exam, open]);

  const isRunning = startedAt !== null && result === null;
  const limitMs = exam?.timeLimitMinutes
    ? exam.timeLimitMinutes * MINUTE_MS
    : null;
  const elapsedMs = startedAt === null ? 0 : now - startedAt;

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(interval);
  }, [isRunning]);

  const submit = useCallback(
    (timedOut: boolean) => {
      if (!exam || startedAt === null || submittedRef.current) {
        return;
      }
      submittedRef.current = true;
      const spent = Date.now() - startedAt;
      const durationMs = limitMs === null ? spent : Math.min(spent, limitMs);
      const score = calculateQuizScore(questions, answers);
      setIsConfirmingSubmit(false);
      setResult({ durationMs, score, timedOut });
      Promise.resolve(
        saveExamAttempt({
          correct: score.correct,
          durationMs,
          examId: exam.id,
          startedAt: new Date(startedAt),
          total: score.total,
        })
      )
        .then(() => onSubmitted?.())
        .catch(() => undefined);
    },
    [answers, exam, limitMs, onSubmitted, questions, startedAt]
  );

  // Out of time: submitted with what was answered (AC-4).
  useEffect(() => {
    if (isRunning && limitMs !== null && elapsedMs >= limitMs) {
      submit(true);
    }
  }, [elapsedMs, isRunning, limitMs, submit]);

  const unanswered = questions.filter(
    (question) => answers[question.id] === undefined
  ).length;

  const handleSubmitClick = useCallback(() => {
    if (unanswered > 0) {
      setIsConfirmingSubmit(true);
      return;
    }
    submit(false);
  }, [submit, unanswered]);

  const handleConfirmSubmit = useCallback(() => submit(false), [submit]);

  const handleChoiceChange = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      const input = event.target as HTMLInputElement;
      if (input.type === "radio" && input.name) {
        setAnswers((prev) => ({ ...prev, [input.name]: input.value }));
      }
    },
    []
  );

  const handleItemChange = useCallback(
    (item: string) => {
      const index = questions.findIndex((question) => question.id === item);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    },
    [questions]
  );

  const handlePreviousClick = useCallback(
    () => setCurrentIndex((prev) => Math.max(0, prev - 1)),
    []
  );
  const handleNextClick = useCallback(
    () => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1)),
    [questions.length]
  );

  // Leaving midway asks first, and saves nothing (AC-5).
  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isRunning) {
        setIsConfirmingLeave(true);
        return;
      }
      onOpenChange(nextOpen);
    },
    [isRunning, onOpenChange]
  );

  const handleLeaveClick = useCallback(() => {
    submittedRef.current = true;
    setIsConfirmingLeave(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const {
    contentRef,
    isShaking,
    preventAndShake: handleInteractOutside,
  } = useDialogShake<HTMLDivElement>();

  const currentQuestion = questions[currentIndex] ?? null;
  const isLastQuestion =
    questions.length > 0 && currentIndex >= questions.length - 1;

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={open}>
      <DialogContent
        className={cn(
          "max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)]",
          result
            ? "grid-rows-[auto_auto_minmax(0,1fr)] sm:max-w-3xl"
            : "grid-rows-[auto_auto_minmax(0,1fr)_auto]"
        )}
        data-shaking={isShaking || undefined}
        onInteractOutside={handleInteractOutside}
        ref={contentRef}
      >
        {/* Clear of the close button, top right. */}
        <DialogHeader className="flex-row items-center justify-between gap-4 pe-8">
          <DialogTitle>{exam?.title}</DialogTitle>
          {isRunning ? (
            <ExamClock elapsedMs={elapsedMs} limitMs={limitMs} />
          ) : null}
        </DialogHeader>
        {result && exam ? (
          <>
            <ExamPassLine passingScore={exam.passingScore} result={result} />
            <QuizScoreResult
              answers={answers}
              averageTimeMs={
                result.score.total === 0
                  ? 0
                  : result.durationMs / result.score.total
              }
              questions={questions}
              result={result.score}
              totalTimeMs={result.durationMs}
            />
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
            >
              <div className="flex flex-col gap-4 py-4">
                {questions.map((question) => (
                  <ExamQuestion key={question.id} question={question} />
                ))}
              </div>
            </Questionnaire>
            <DialogFooter className="sm:justify-between">
              <Button
                disabled={currentIndex === 0}
                onClick={handlePreviousClick}
                type="button"
                variant="outline"
              >
                {t("previousQuestionAction")}
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {isLastQuestion ? null : (
                  <Button
                    onClick={handleNextClick}
                    type="button"
                    variant="outline"
                  >
                    {t("nextQuestionAction")}
                  </Button>
                )}
                <Button
                  disabled={questions.length === 0}
                  onClick={handleSubmitClick}
                  type="button"
                  variant={isLastQuestion ? "default" : "ghost"}
                >
                  {t("submitExamAction")}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
      <AlertDialog
        onOpenChange={setIsConfirmingSubmit}
        open={isConfirmingSubmit}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("examSubmitConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("examUnansweredConfirm", { count: unanswered })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("examKeepAnsweringAction")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>
              {t("submitExamAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog onOpenChange={setIsConfirmingLeave} open={isConfirmingLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("examLeaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("examLeaveDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("examLeaveStayAction")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveClick}>
              {t("examLeaveConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
