import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createQuizOption,
  createQuizQuestion,
  listQuizQuestionsWithOptions,
  softDeleteQuizOption,
  softDeleteQuizQuestion,
  updateQuizQuestion,
} from "@/actions/quiz";
import type { Activity } from "@/components/activities-data-table";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownContent from "@/components/markdown-content";
import QuizQuestionFormDialog, {
  type QuizQuestionFormValue,
  type QuizQuestionSubmitOption,
} from "@/components/quiz-question-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuizQuestionWithOptions {
  id: string;
  imagePath: string | null;
  options: {
    id: string;
    imagePath: string | null;
    isCorrect: boolean;
    text: string;
  }[];
  text: string;
}

interface QuizQuestionRowProps {
  deleteLabel: string;
  editLabel: string;
  onDelete: (question: QuizQuestionWithOptions) => void;
  onEdit: (question: QuizQuestionWithOptions) => void;
  question: QuizQuestionWithOptions;
}

function QuizQuestionRow({
  deleteLabel,
  editLabel,
  onDelete,
  onEdit,
  question,
}: QuizQuestionRowProps) {
  const handleEditClick = useCallback(() => {
    onEdit(question);
  }, [onEdit, question]);

  const handleDeleteClick = useCallback(() => {
    onDelete(question);
  }, [onDelete, question]);

  return (
    <li className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MarkdownContent className="flex-1" content={question.text} />
        <ImageAttachmentViewer fileName={question.imagePath} />
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          aria-label={editLabel}
          onClick={handleEditClick}
          size="icon"
          variant="ghost"
        >
          <Pencil />
        </Button>
        <Button
          aria-label={deleteLabel}
          onClick={handleDeleteClick}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

interface QuizQuestionManagerDialogProps {
  activity: Activity | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function QuizQuestionManagerDialog({
  activity,
  onOpenChange,
  open,
}: QuizQuestionManagerDialogProps) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<QuizQuestionWithOptions[]>([]);
  const [formQuestion, setFormQuestion] =
    useState<QuizQuestionFormValue | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const refreshQuestions = useCallback(() => {
    if (!activity) {
      return;
    }

    listQuizQuestionsWithOptions(activity.id).then(setQuestions);
  }, [activity]);

  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  const handleAddClick = useCallback(() => {
    setFormQuestion(null);
    setIsFormOpen(true);
  }, []);

  const handleEditClick = useCallback((question: QuizQuestionWithOptions) => {
    setFormQuestion({
      id: question.id,
      imagePath: question.imagePath,
      options: question.options,
      text: question.text,
    });
    setIsFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback(
    (question: QuizQuestionWithOptions) => {
      Promise.resolve(softDeleteQuizQuestion(question.id)).then(() => {
        refreshQuestions();
      });
    },
    [refreshQuestions]
  );

  const handleFormOpenChange = useCallback((nextOpen: boolean) => {
    setIsFormOpen(nextOpen);
  }, []);

  const handleFormSubmit = useCallback(
    (
      text: string,
      imagePath: string | null,
      options: QuizQuestionSubmitOption[]
    ) => {
      if (!activity) {
        return;
      }

      if (formQuestion) {
        const questionId = formQuestion.id;
        const staleOptionIds = formQuestion.options.map((option) => option.id);

        updateQuizQuestion(questionId, text, imagePath)
          .then(() =>
            Promise.all(staleOptionIds.map((id) => softDeleteQuizOption(id)))
          )
          .then(() =>
            Promise.all(
              options.map((option) =>
                createQuizOption(
                  questionId,
                  option.text,
                  option.isCorrect,
                  option.imagePath
                )
              )
            )
          )
          .then(() => {
            setIsFormOpen(false);
            refreshQuestions();
          });
      } else {
        createQuizQuestion(activity.id, text, imagePath)
          .then((created) =>
            Promise.all(
              options.map((option) =>
                createQuizOption(
                  created.id,
                  option.text,
                  option.isCorrect,
                  option.imagePath
                )
              )
            )
          )
          .then(() => {
            setIsFormOpen(false);
            refreshQuestions();
          });
      }
    },
    [activity, formQuestion, refreshQuestions]
  );

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        {/* Capped to the window: the question list scrolls, the header stays put. */}
        <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activity?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={handleAddClick}>
              {t("addQuizQuestionAction")}
            </Button>
          </div>
          <div className="-mx-1 min-h-0 overflow-y-auto px-1 pb-2 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
            {questions.length === 0 ? (
              <p>{t("quizQuestionsEmptyMessage")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {questions.map((question) => (
                  <QuizQuestionRow
                    deleteLabel={t("deleteQuizQuestionAction")}
                    editLabel={t("editQuizQuestionAction")}
                    key={question.id}
                    onDelete={handleDeleteClick}
                    onEdit={handleEditClick}
                    question={question}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <QuizQuestionFormDialog
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
        question={formQuestion}
      />
    </>
  );
}
