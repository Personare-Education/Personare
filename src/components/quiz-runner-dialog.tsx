import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listQuizQuestionsWithOptions } from "@/actions/quiz";
import type { Activity } from "@/components/activities-data-table";
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
    <div className="flex items-start gap-2 border-b pb-3 text-sm last:border-b-0 last:pb-0">
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
    </div>
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

function QuizRunnerResult({
  answers,
  averageTimeMs,
  questions,
  result,
  totalTimeMs,
}: QuizRunnerResultProps) {
  const { t } = useTranslation();
  const reviewHeadingId = useId();
  const score =
    result.total === 0
      ? 0
      : Math.round((result.correct / result.total) * QUIZ_MAX_SCORE);

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col items-center gap-4">
        <RadialChartStacked
          centerLabel={String(score)}
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
        <div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
          <p>
            {t("quizResultMessage", {
              correct: result.correct,
              total: result.total,
            })}
          </p>
          <p>
            {t("quizTotalTimeLabel", {
              duration: formatQuizDuration(totalTimeMs),
            })}
          </p>
          <p>
            {t("quizAverageTimeLabel", {
              duration: formatQuizDuration(averageTimeMs),
            })}
          </p>
        </div>
      </div>
      <section
        aria-labelledby={reviewHeadingId}
        className="flex flex-col gap-3"
      >
        <h3 className="font-medium text-sm" id={reviewHeadingId}>
          {t("quizReviewHeading")}
        </h3>
        {questions.map((question) => (
          <QuizRunnerReviewRow
            answers={answers}
            key={question.id}
            question={question}
          />
        ))}
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
      <DialogContent>
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
