import { CheckCircle2, XCircle } from "lucide-react";
import {
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownContent from "@/components/markdown-content";
import type { QuizAnswers } from "@/utils/quiz-scoring";

export interface QuizRunnerOption {
  id: string;
  imagePath: string | null;
  isCorrect: boolean;
  text: string;
}

export interface QuizRunnerQuestion {
  id: string;
  imagePath: string | null;
  options: QuizRunnerOption[];
  text: string;
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
          className="mt-0.5 size-4 shrink-0 text-success-text"
          role="img"
        />
      ) : (
        <XCircle
          aria-label={t("quizReviewIncorrectStatusLabel")}
          className="mt-0.5 size-4 shrink-0 text-destructive-text"
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

interface QuizAnswerReviewProps {
  answers: QuizAnswers;
  questions: QuizRunnerQuestion[];
}

/**
 * The answers, question by question, once a quiz is over: what was chosen,
 * whether it was right and, when not, the right answer. Shared by the
 * quiz's result and the score result kept for the exam type
 * (docs/specs/quiz-result-rating.md).
 */
export function QuizAnswerReview({
  answers,
  questions,
}: QuizAnswerReviewProps) {
  const { t } = useTranslation();
  const reviewHeadingId = useId();
  const reviewListRef = useRef<HTMLOListElement>(null);
  const reviewListMaxHeight = useVisibleRowsMaxHeight(
    reviewListRef,
    QUIZ_REVIEW_VISIBLE_ROWS
  );

  return (
    <section
      aria-labelledby={reviewHeadingId}
      className="flex min-h-0 flex-col gap-3"
    >
      <h3 className="font-medium text-sm" id={reviewHeadingId}>
        {t("quizReviewHeading")}
      </h3>
      <ol
        className="relative flex min-h-0 flex-col gap-3 overflow-y-auto pe-2 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
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
  );
}
