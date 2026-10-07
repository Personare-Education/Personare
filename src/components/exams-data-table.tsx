import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ActionableTableRow, {
  type RowAction,
} from "@/components/actionable-table-row";
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
  moduleNames: Record<string, string | undefined>;
  onEdit: (exam: Exam) => void;
  onEditQuestions: (exam: Exam) => void;
  onRequestDelete: (exam: Exam) => void;
}

interface ExamRowProps extends Omit<ExamsDataTableProps, "exams"> {
  exam: Exam;
}

function ExamRow({
  exam,
  moduleNames,
  onEdit,
  onEditQuestions,
  onRequestDelete,
}: ExamRowProps) {
  const { t } = useTranslation();

  // The first action is what clicking the row does.
  const actions = useMemo<RowAction[]>(
    () => [
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
      {
        destructive: true,
        icon: <Trash2 />,
        key: "delete",
        label: t("deleteExamAction"),
        onSelect: () => onRequestDelete(exam),
      },
    ],
    [exam, onEdit, onEditQuestions, onRequestDelete, t]
  );

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
      <TableCell className="font-medium">{exam.title}</TableCell>
      <TableCell>
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
        {t("examQuestionCount", { count: exam.questionCount })}
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
export default function ExamsDataTable({
  exams,
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
            <ExamRow exam={exam} key={exam.id} {...rowProps} />
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
