import { History, ListChecks, Lock, Pencil, Play, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ActionableTableRow, {
  type RowAction,
} from "@/components/actionable-table-row";
import LockLabel from "@/components/lock-label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";

/** An exam as the program page lists it (docs/specs/exams.md §1 AC-3). */
export interface Exam {
  /** How many questions an attempt would have now; 0 when none. */
  availableCount: number;
  /** The best share of right answers, 0 to 1; null before any attempt. */
  bestScore: number | null;
  id: string;
  lastAttemptAt: Date | null;
  moduleIds: string[];
  passed: boolean;
  passingScore: number;
  questionCount: number;
  standaloneCount: number;
  timeLimitMinutes: number | null;
  title: string;
}

/** Scores read out of 1000, as the result screen shows them. */
export const EXAM_MAX_SCORE = 1000;

interface ExamsDataTableProps {
  exams: Exam[];
  /** What each locked exam is missing; absent means free (exam-locks.md AC-3). */
  lockLabelById?: Record<string, string | undefined>;
  moduleNames: Record<string, string | undefined>;
  onEdit: (exam: Exam) => void;
  onEditQuestions: (exam: Exam) => void;
  /** Its past attempts (docs/specs/exams.md §3 AC-7). */
  onHistory: (exam: Exam) => void;
  onRequestDelete: (exam: Exam) => void;
  /** Takes the exam (docs/specs/exams.md §3 AC-1). */
  onTake: (exam: Exam) => void;
  /** Opens its unlock rule (docs/specs/exam-locks.md AC-5). */
  onUnlockRule?: (exam: Exam) => void;
}

interface ExamRowProps
  extends Omit<ExamsDataTableProps, "exams" | "lockLabelById"> {
  exam: Exam;
  lockLabel: string | undefined;
}

function ExamRow({
  exam,
  lockLabel,
  moduleNames,
  onEdit,
  onEditQuestions,
  onHistory,
  onRequestDelete,
  onTake,
  onUnlockRule,
}: ExamRowProps) {
  const { t } = useTranslation();
  const canTake = exam.availableCount > 0;
  const isLocked = lockLabel !== undefined;

  // The first action is what clicking the row does: taking the exam, or
  // editing it when it has nothing to draw (docs/specs/exams.md §3 AC-1).
  // Locked, it cannot be taken: its rule leads (exam-locks.md AC-3).
  const actions = useMemo<RowAction[]>(() => {
    const rule: RowAction[] = onUnlockRule
      ? [
          {
            icon: <Lock />,
            key: "unlock-rule",
            label: t("unlockRuleAction"),
            onSelect: () => onUnlockRule(exam),
          },
        ]
      : [];
    return [
      ...(isLocked ? rule : []),
      ...(canTake && !isLocked
        ? [
            {
              icon: <Play />,
              key: "take",
              label: t("takeExamAction"),
              onSelect: () => onTake(exam),
            },
          ]
        : []),
      {
        icon: <Pencil />,
        key: "edit",
        label: t("editExamAction"),
        onSelect: () => onEdit(exam),
      },
      {
        icon: <ListChecks />,
        key: "questions",
        label: t("examQuestionsAction"),
        onSelect: () => onEditQuestions(exam),
      },
      ...(isLocked ? [] : rule),
      {
        icon: <History />,
        key: "history",
        label: t("examHistoryAction"),
        onSelect: () => onHistory(exam),
      },
      {
        destructive: true,
        icon: <Trash2 />,
        key: "delete",
        label: t("deleteExamAction"),
        onSelect: () => onRequestDelete(exam),
      },
    ];
  }, [
    canTake,
    exam,
    isLocked,
    onEdit,
    onEditQuestions,
    onHistory,
    onRequestDelete,
    onTake,
    onUnlockRule,
    t,
  ]);

  const sources = exam.moduleIds
    .map((id) => moduleNames[id])
    .filter((name): name is string => name !== undefined)
    .join(", ");
  let best = t("examNotTaken");
  if (exam.bestScore !== null) {
    const score = Math.round(exam.bestScore * EXAM_MAX_SCORE);
    best = exam.passed
      ? t("examBestScorePassed", { score })
      : t("examBestScoreFailed", { score });
  }

  return (
    <ActionableTableRow
      actions={actions}
      onOpen={actions[0].onSelect}
      rowId={exam.id}
    >
      {/* Wraps, so a long name or padlock does not push the actions off. */}
      <TableCell className="whitespace-normal font-medium">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {exam.title}
          {lockLabel ? <LockLabel label={lockLabel} /> : null}
        </span>
      </TableCell>
      <TableCell className="whitespace-normal">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>{sources}</span>
          {exam.standaloneCount > 0 ? (
            <span className="text-muted-foreground text-sm">
              {t("examStandaloneCount", { count: exam.standaloneCount })}
            </span>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="tabular-nums">
        {canTake ? (
          t("examQuestionCount", { count: exam.questionCount })
        ) : (
          <span className="text-muted-foreground">
            {t("examNothingToDrawLabel")}
          </span>
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {exam.timeLimitMinutes === null
          ? t("examNoTimeLimit")
          : t("examTimeMinutes", { count: exam.timeLimitMinutes })}
      </TableCell>
      <TableCell className="tabular-nums">{best}</TableCell>
    </ActionableTableRow>
  );
}

/** The program's exams (docs/specs/exams.md §2 AC-2). */
const NO_LOCKS: Record<string, string | undefined> = {};

export default function ExamsDataTable({
  exams,
  lockLabelById = NO_LOCKS,
  ...rowProps
}: ExamsDataTableProps) {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("examTitleLabel")}</TableHead>
            <TableHead>{t("examSourcesColumnLabel")}</TableHead>
            <TableHead>{t("examQuestionsColumnLabel")}</TableHead>
            <TableHead>{t("examTimeColumnLabel")}</TableHead>
            <TableHead>{t("examBestColumnLabel")}</TableHead>
            <TableHead>{t("actionsColumnLabel")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exams.map((exam) => (
            <ExamRow
              exam={exam}
              key={exam.id}
              lockLabel={lockLabelById[exam.id]}
              {...rowProps}
            />
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
