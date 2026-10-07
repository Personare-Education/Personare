import { ListChecks } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExamFields } from "@/actions/exams";
import type { Exam } from "@/components/exams-data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/utils/tailwind";

/** A module the exam can draw from, with its quiz questions. */
export interface ExamModuleOption {
  id: string;
  name: string;
  questionCount: number;
}

interface ExamFormDialogProps {
  exam: Exam | null;
  modules: ExamModuleOption[];
  /**
   * Opens the exam's standalone questions, apart from saving
   * (docs/specs/exams.md §2 AC-4); a new exam is saved first, with these
   * fields, since the questions belong to it.
   */
  onEditQuestions: (fields: ExamFields) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (fields: ExamFields) => void;
  open: boolean;
  /** How many standalone questions the exam has now, for its button. */
  standaloneCount?: number;
}

const DEFAULT_QUESTION_COUNT = 10;
const DEFAULT_PASSING_SCORE = 70;
const DIGITS = /^\d+$/;

/** A whole number from an input, or null when it is not one. */
function wholeNumber(value: string): number | null {
  return DIGITS.test(value.trim()) ? Number(value.trim()) : null;
}

/**
 * An exam's title, the modules it draws from (only the ones with a quiz),
 * how many questions to draw, an optional time limit and the score to pass
 * (docs/specs/exams.md §2 AC-3).
 */
export default function ExamFormDialog({
  exam,
  modules,
  onEditQuestions,
  onOpenChange,
  onSubmit,
  open,
  standaloneCount = exam?.standaloneCount ?? 0,
}: ExamFormDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const countId = useId();
  const timeId = useId();
  const timeHintId = useId();
  const questionsHintId = useId();
  const scoreId = useId();
  const modulesLabelId = useId();
  const [title, setTitle] = useState("");
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [count, setCount] = useState(String(DEFAULT_QUESTION_COUNT));
  const [timeLimit, setTimeLimit] = useState("");
  const [passingScore, setPassingScore] = useState(
    String(DEFAULT_PASSING_SCORE)
  );

  useEffect(() => {
    if (open) {
      setTitle(exam?.title ?? "");
      setModuleIds(exam?.moduleIds ?? []);
      setCount(String(exam?.questionCount ?? DEFAULT_QUESTION_COUNT));
      setTimeLimit(exam?.timeLimitMinutes ? String(exam.timeLimitMinutes) : "");
      setPassingScore(String(exam?.passingScore ?? DEFAULT_PASSING_SCORE));
    }
  }, [exam, open]);

  // Only modules that still have a quiz can be drawn from.
  const chosen = modules.filter(
    (module) => module.questionCount > 0 && moduleIds.includes(module.id)
  );
  const available = chosen.reduce(
    (sum, module) => sum + module.questionCount,
    0
  );
  const questionCount = wholeNumber(count);
  const minutes = timeLimit.trim() === "" ? null : wholeNumber(timeLimit);
  const score = wholeNumber(passingScore);
  const canSave =
    title.trim() !== "" &&
    chosen.length > 0 &&
    questionCount !== null &&
    questionCount >= 1 &&
    (timeLimit.trim() === "" || (minutes !== null && minutes >= 1)) &&
    score !== null &&
    score >= 1 &&
    score <= 100;

  const handleToggle = useCallback((id: string, checked: boolean) => {
    setModuleIds((prev) =>
      checked ? [...prev, id] : prev.filter((selected) => selected !== id)
    );
  }, []);

  // The form as it stands, once it can be saved.
  const fields = useMemo<ExamFields | null>(
    () =>
      canSave && questionCount !== null && score !== null
        ? {
            // In the program's order, whatever order they were checked in.
            moduleIds: chosen.map((module) => module.id),
            passingScore: score,
            questionCount,
            timeLimitMinutes: minutes,
            title: title.trim(),
          }
        : null,
    [canSave, chosen, minutes, questionCount, score, title]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (fields) {
        onSubmit(fields);
      }
    },
    [fields, onSubmit]
  );

  const handleQuestionsClick = useCallback(() => {
    if (fields) {
      onEditQuestions(fields);
    }
  }, [fields, onEditQuestions]);

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setTitle(event.target.value),
    []
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] sm:max-w-lg">
        <form className="flex min-h-0 flex-col gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {exam ? t("editExamTitle") : t("createExamTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
            <div className="flex flex-col gap-1">
              <Label htmlFor={titleId}>{t("examTitleLabel")}</Label>
              <Input
                id={titleId}
                onChange={handleTitleChange}
                required
                value={title}
              />
            </div>
            {/* biome-ignore lint/a11y/useSemanticElements: a named group of checkboxes; a fieldset's legend would not take this layout. */}
            <div
              aria-labelledby={modulesLabelId}
              className="flex flex-col gap-1"
              role="group"
            >
              <span className="font-medium text-sm" id={modulesLabelId}>
                {t("examModulesLabel")}
              </span>
              {modules.map((module) => (
                <ExamModuleItem
                  checked={moduleIds.includes(module.id)}
                  key={module.id}
                  module={module}
                  onToggle={handleToggle}
                />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={countId}>{t("examQuestionCountLabel")}</Label>
                <NumberInput
                  id={countId}
                  min={1}
                  onValueChange={setCount}
                  value={count}
                />
                <p className="text-muted-foreground text-xs">
                  {t("examModulesAvailable", { count: available })}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={scoreId}>{t("examPassingScoreLabel")}</Label>
                <NumberInput
                  id={scoreId}
                  max={100}
                  min={1}
                  onValueChange={setPassingScore}
                  value={passingScore}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={timeId}>{t("examTimeLimitLabel")}</Label>
                <NumberInput
                  aria-describedby={timeHintId}
                  id={timeId}
                  min={1}
                  onValueChange={setTimeLimit}
                  value={timeLimit}
                />
                <p className="text-muted-foreground text-xs" id={timeHintId}>
                  {t("examTimeLimitHint")}
                </p>
              </div>
            </div>
          </div>
          {/* Standalone questions apart from Save, on the left. */}
          <DialogFooter className="sm:items-center sm:justify-between">
            <div className="flex flex-col items-start gap-1">
              <Button
                aria-describedby={exam ? undefined : questionsHintId}
                disabled={fields === null}
                onClick={handleQuestionsClick}
                type="button"
                variant="outline"
              >
                <ListChecks />
                {exam && standaloneCount > 0
                  ? t("examQuestionsCountAction", { count: standaloneCount })
                  : t("examQuestionsAction")}
              </Button>
              {exam ? null : (
                <p
                  className="text-muted-foreground text-xs"
                  id={questionsHintId}
                >
                  {t("examQuestionsSavesFirstHint")}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button onClick={handleCancel} type="button" variant="outline">
                {t("cancelAction")}
              </Button>
              <Button disabled={!canSave} type="submit">
                {t("saveAction")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ExamModuleItemProps {
  checked: boolean;
  module: ExamModuleOption;
  onToggle: (id: string, checked: boolean) => void;
}

/** A module to draw from; one without a quiz is shown, turned off. */
function ExamModuleItem({ checked, module, onToggle }: ExamModuleItemProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const noteId = useId();
  const hasQuiz = module.questionCount > 0;
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onToggle(module.id, event.target.checked),
    [module.id, onToggle]
  );

  return (
    <label
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
        hasQuiz ? "cursor-pointer hover:bg-muted/50" : "text-muted-foreground"
      )}
      htmlFor={inputId}
    >
      <input
        aria-describedby={noteId}
        checked={hasQuiz && checked}
        className="size-4 shrink-0 accent-[var(--primary)]"
        disabled={!hasQuiz}
        id={inputId}
        onChange={handleChange}
        type="checkbox"
      />
      <span className="flex-1">{module.name}</span>
      <span className="text-muted-foreground text-xs tabular-nums" id={noteId}>
        {hasQuiz
          ? t("examModuleQuestionCount", { count: module.questionCount })
          : t("examModuleNoQuiz")}
      </span>
    </label>
  );
}
