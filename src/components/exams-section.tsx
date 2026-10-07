import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createExam,
  type ExamFields,
  listEligibleExamModules,
  listExams,
  restoreExam,
  softDeleteExam,
  updateExam,
} from "@/actions/exams";
import ExamFormDialog, {
  type ExamModuleOption,
} from "@/components/exam-form-dialog";
import ExamsDataTable, { type Exam } from "@/components/exams-data-table";
import QuizQuestionManagerDialog from "@/components/quiz-question-manager-dialog";
import { Button } from "@/components/ui/button";
import { showUndoToast } from "@/utils/undo-toast";

interface ExamsSectionProps {
  moduleNames: Record<string, string | undefined>;
  /** After the exams change (an attempt, an edit, a deletion). */
  onExamsChange?: () => void;
  programId: string;
}

/**
 * The program's exams, below its modules (docs/specs/exams.md §2): the
 * list, creating and editing one, its standalone questions, and deleting
 * with undo.
 */
export default function ExamsSection({
  moduleNames,
  onExamsChange,
  programId,
}: ExamsSectionProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [exams, setExams] = useState<Exam[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [modules, setModules] = useState<ExamModuleOption[]>([]);
  const [formExam, setFormExam] = useState<Exam | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [questionsExam, setQuestionsExam] = useState<Exam | null>(null);

  const refreshExams = useCallback(() => {
    listExams(programId).then((loaded) => {
      setExams(loaded);
      setHasLoaded(true);
    });
  }, [programId]);

  useEffect(() => {
    refreshExams();
  }, [refreshExams]);

  const changed = useCallback(() => {
    refreshExams();
    onExamsChange?.();
  }, [onExamsChange, refreshExams]);

  // The modules (and their quiz questions) as they are when the form opens.
  const openForm = useCallback(
    (exam: Exam | null) => {
      listEligibleExamModules(programId).then((loaded) => {
        setModules(loaded);
        setFormExam(exam);
        setIsFormOpen(true);
      });
    },
    [programId]
  );

  const handleCreateClick = useCallback(() => openForm(null), [openForm]);

  const handleFormSubmit = useCallback(
    (fields: ExamFields) => {
      if (formExam) {
        updateExam(formExam.id, fields).then(() => {
          setIsFormOpen(false);
          changed();
        });
        return;
      }
      // A new exam goes on to its standalone questions (AC-4).
      createExam(programId, fields).then((created) => {
        setIsFormOpen(false);
        changed();
        setQuestionsExam({
          ...created,
          bestScore: null,
          lastAttemptAt: null,
          moduleIds: fields.moduleIds,
          passed: false,
          standaloneCount: 0,
        });
      });
    },
    [changed, formExam, programId]
  );

  // Brings back what was just deleted (docs/specs/safety-net.md AC-2).
  const undoDelete = useCallback(
    (id: string) => {
      restoreExam(id).then(changed);
    },
    [changed]
  );

  const handleRequestDelete = useCallback(
    (exam: Exam) => {
      softDeleteExam(exam.id).then(() => {
        changed();
        // docs/specs/safety-net.md AC-1
        showUndoToast({
          message: t("examDeletedMessage", { title: exam.title }),
          onUndo: () => undoDelete(exam.id),
          undoLabel: t("undoAction"),
        });
      });
    },
    [changed, t, undoDelete]
  );

  const handleQuestionsOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setQuestionsExam(null);
        refreshExams();
      }
    },
    [refreshExams]
  );

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 pt-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium font-serif text-xl" id={headingId}>
          {t("examsSectionTitle")}
        </h2>
        <Button onClick={handleCreateClick} variant="outline">
          {t("createExamAction")}
        </Button>
      </div>
      {hasLoaded && exams.length === 0 ? (
        <p className="max-w-lg text-muted-foreground text-sm leading-relaxed">
          {t("examsEmptyMessage")}
        </p>
      ) : null}
      {exams.length > 0 ? (
        <ExamsDataTable
          exams={exams}
          moduleNames={moduleNames}
          onEdit={openForm}
          onEditQuestions={setQuestionsExam}
          onRequestDelete={handleRequestDelete}
        />
      ) : null}
      <ExamFormDialog
        exam={formExam}
        modules={modules}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
      />
      <QuizQuestionManagerDialog
        activity={null}
        exam={questionsExam}
        onOpenChange={handleQuestionsOpenChange}
        open={questionsExam !== null}
      />
    </section>
  );
}
