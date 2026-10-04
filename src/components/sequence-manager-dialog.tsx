import {
  ArrowDown,
  ArrowUp,
  FileText,
  Link,
  ListChecks,
  type LucideIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createActivity,
  listActivities,
  reorderActivities,
  restoreActivity,
  softDeleteActivity,
  updateActivity,
} from "@/actions/activities";
import { createQuizWithQuestions } from "@/actions/quiz";
import ActionIconButton from "@/components/action-icon-button";
import type { Activity } from "@/components/activities-data-table";
import ActivityFormDialog, {
  type ActivityTypeOption,
} from "@/components/activity-form-dialog";
import DeleteActivityDialog from "@/components/delete-activity-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ParsedQuizQuestion } from "@/utils/quiz-markdown";
import { showUndoToast } from "@/utils/undo-toast";

/** What a sequence holds (docs/specs/sequences-and-locks.md §3 AC-2). */
const SEQUENCE_STEP_TYPES: readonly ActivityTypeOption[] = [
  "link",
  "quiz",
  "pdf",
];

const STEP_ICONS: Record<string, LucideIcon> = {
  link: Link,
  pdf: FileText,
  quiz: ListChecks,
};

const STEP_TYPE_LABEL_KEYS: Record<string, string> = {
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

interface StepRowProps {
  index: number;
  isLast: boolean;
  onDelete: (step: Activity) => void;
  onEdit: (step: Activity) => void;
  onManageQuiz: (step: Activity, isNew: boolean) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  step: Activity;
}

function StepRow({
  index,
  isLast,
  onDelete,
  onEdit,
  onManageQuiz,
  onMove,
  step,
}: StepRowProps) {
  const { t } = useTranslation();
  const Icon = STEP_ICONS[step.type] ?? FileText;
  const handleUp = useCallback(() => onMove(index, -1), [index, onMove]);
  const handleDown = useCallback(() => onMove(index, 1), [index, onMove]);
  const handleEdit = useCallback(() => onEdit(step), [onEdit, step]);
  const handleDelete = useCallback(() => onDelete(step), [onDelete, step]);
  const handleManageQuiz = useCallback(
    () => onManageQuiz(step, false),
    [onManageQuiz, step]
  );

  return (
    <li className="flex items-center gap-3 border-b py-2 last:border-b-0">
      {/* The step's place in the order, the sequence's whole point. */}
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 font-medium text-brand-text text-xs tabular-nums"
      >
        {index + 1}
      </span>
      <Icon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-sm" data-slot="step-title">
          {step.title}
        </span>
        <span className="text-muted-foreground text-xs">
          {t(STEP_TYPE_LABEL_KEYS[step.type] ?? "activityTypeLabel")}
        </span>
      </span>
      <span className="flex shrink-0 items-center">
        <ActionIconButton
          disabled={index === 0}
          label={t("moveUpAction")}
          onClick={handleUp}
        >
          <ArrowUp />
        </ActionIconButton>
        <ActionIconButton
          disabled={isLast}
          label={t("moveDownAction")}
          onClick={handleDown}
        >
          <ArrowDown />
        </ActionIconButton>
        {step.type === "quiz" ? (
          <ActionIconButton
            label={t("manageQuizQuestionsAction")}
            onClick={handleManageQuiz}
          >
            <ListChecks />
          </ActionIconButton>
        ) : null}
        <ActionIconButton label={t("editActivityAction")} onClick={handleEdit}>
          <Pencil />
        </ActionIconButton>
        <ActionIconButton
          label={t("deleteActivityAction")}
          onClick={handleDelete}
        >
          <Trash2 />
        </ActionIconButton>
      </span>
    </li>
  );
}

interface SequenceManagerDialogProps {
  group: Activity | null;
  /** After anything changed in the sequence, e.g. to refresh its count. */
  onChanged?: () => void;
  /** A quiz in the sequence opens its questions; a new one starts there. */
  onManageQuiz: (quiz: Activity, isNew: boolean) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/**
 * A sequence's activities, in the order they are done
 * (docs/specs/sequences-and-locks.md §3 AC-2): add PDFs, links and
 * quizzes, move them, edit or remove them.
 */
export default function SequenceManagerDialog({
  group,
  onChanged,
  onManageQuiz,
  onOpenChange,
  open,
}: SequenceManagerDialogProps) {
  const { t } = useTranslation();
  const [steps, setSteps] = useState<Activity[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Activity | null>(null);
  const [stepPendingDelete, setStepPendingDelete] = useState<Activity | null>(
    null
  );

  const refresh = useCallback(() => {
    if (!group) {
      return;
    }
    listActivities(group.moduleId, group.id).then((loaded) => {
      setSteps(loaded);
      setHasLoaded(true);
    });
  }, [group]);

  useEffect(() => {
    if (open) {
      setHasLoaded(false);
      refresh();
    }
  }, [open, refresh]);

  const changed = useCallback(() => {
    refresh();
    onChanged?.();
  }, [onChanged, refresh]);

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      if (!group) {
        return;
      }
      const next = [...steps];
      const [moved] = next.splice(index, 1);
      next.splice(index + direction, 0, moved);
      setSteps(next);
      reorderActivities(
        group.moduleId,
        group.id,
        next.map((step) => step.id)
      ).then(() => onChanged?.());
    },
    [group, onChanged, steps]
  );

  const handleAddClick = useCallback(() => {
    setEditingStep(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((step: Activity) => {
    setEditingStep(step);
    setIsFormOpen(true);
  }, []);

  const handleSubmit = useCallback(
    (
      title: string,
      type: string,
      url: string | null,
      filePath: string | null
    ) => {
      if (!group) {
        return;
      }
      if (editingStep) {
        updateActivity(editingStep.id, title, type, url, filePath).then(() => {
          setIsFormOpen(false);
          changed();
        });
        return;
      }
      createActivity(group.moduleId, title, type, url, filePath, group.id).then(
        (created) => {
          setIsFormOpen(false);
          changed();
          // A new quiz goes straight to its first question, as elsewhere.
          if (type === "quiz") {
            onManageQuiz(created, true);
          }
        }
      );
    },
    [changed, editingStep, group, onManageQuiz]
  );

  const handleImportQuiz = useCallback(
    (title: string, questions: ParsedQuizQuestion[]) => {
      if (!group) {
        return;
      }
      createQuizWithQuestions(group.moduleId, title, questions, group.id).then(
        () => {
          setIsFormOpen(false);
          changed();
        }
      );
    },
    [changed, group]
  );

  // Brings back what was just removed (docs/specs/safety-net.md AC-2).
  const undoDelete = useCallback(
    (id: string) => {
      restoreActivity(id).then(changed);
    },
    [changed]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!stepPendingDelete) {
      return;
    }
    const deleted = stepPendingDelete;
    softDeleteActivity(deleted.id).then(() => {
      setStepPendingDelete(null);
      changed();
      showUndoToast({
        message: t("activityDeletedMessage", { title: deleted.title }),
        onUndo: () => undoDelete(deleted.id),
        undoLabel: t("undoAction"),
      });
    });
  }, [changed, stepPendingDelete, t, undoDelete]);

  const handleDeleteOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setStepPendingDelete(null);
    }
  }, []);

  const handleDoneClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{group?.title}</DialogTitle>
          <DialogDescription>
            {t("sequenceManagerDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 overflow-y-auto px-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          {hasLoaded && steps.length === 0 ? (
            <p className="py-2 text-muted-foreground text-sm">
              {t("sequenceEmptyMessage")}
            </p>
          ) : (
            <TooltipProvider>
              <ol aria-label={group?.title}>
                {steps.map((step, index) => (
                  <StepRow
                    index={index}
                    isLast={index === steps.length - 1}
                    key={step.id}
                    onDelete={setStepPendingDelete}
                    onEdit={handleEdit}
                    onManageQuiz={onManageQuiz}
                    onMove={handleMove}
                    step={step}
                  />
                ))}
              </ol>
            </TooltipProvider>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button onClick={handleAddClick} type="button" variant="outline">
            <Plus />
            {t("addSequenceStepAction")}
          </Button>
          <Button onClick={handleDoneClick} type="button">
            {t("concludeQuizEditingAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ActivityFormDialog
        activity={editingStep}
        allowedTypes={SEQUENCE_STEP_TYPES}
        onImportQuiz={handleImportQuiz}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
        open={isFormOpen}
      />
      <DeleteActivityDialog
        activity={stepPendingDelete}
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteOpenChange}
        open={stepPendingDelete !== null}
      />
    </Dialog>
  );
}
