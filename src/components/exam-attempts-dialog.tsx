import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listExamAttempts } from "@/actions/exams";
import { EXAM_MAX_SCORE } from "@/components/exams-data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatQuizDuration } from "@/utils/quiz-scoring";

interface ExamAttempt {
  correct: number;
  durationMs: number;
  id: string;
  startedAt: Date;
  total: number;
}

interface ExamAttemptsDialogProps {
  exam: { id: string; passingScore: number; title: string } | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/**
 * An exam's past attempts, newest first: when, the score and whether it
 * passed, how many were right and how long it took (docs/specs/exams.md §3
 * AC-7).
 */
export default function ExamAttemptsDialog({
  exam,
  onOpenChange,
  open,
}: ExamAttemptsDialogProps) {
  const { i18n, t } = useTranslation();
  const [attempts, setAttempts] = useState<ExamAttempt[] | null>(null);

  useEffect(() => {
    if (open && exam) {
      setAttempts(null);
      listExamAttempts(exam.id).then(setAttempts);
    }
  }, [exam, open]);

  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("examHistoryTitle", { title: exam?.title ?? "" })}
          </DialogTitle>
        </DialogHeader>
        <div className="-mx-1 min-h-0 overflow-y-auto px-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          {attempts?.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("examAttemptsEmptyMessage")}
            </p>
          ) : null}
          {attempts && attempts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("examAttemptDateColumnLabel")}</TableHead>
                  <TableHead>{t("examAttemptScoreColumnLabel")}</TableHead>
                  <TableHead>{t("examAttemptCorrectColumnLabel")}</TableHead>
                  <TableHead>{t("examAttemptTimeColumnLabel")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => {
                  const share =
                    attempt.total === 0 ? 0 : attempt.correct / attempt.total;
                  const score = Math.round(share * EXAM_MAX_SCORE);
                  const passed = share * 100 >= (exam?.passingScore ?? 0);
                  return (
                    <TableRow key={attempt.id}>
                      <TableCell>
                        {dateFormat.format(attempt.startedAt)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {passed
                          ? t("examBestScorePassed", { score })
                          : t("examBestScoreFailed", { score })}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {t("examAttemptCorrect", {
                          correct: attempt.correct,
                          total: attempt.total,
                        })}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatQuizDuration(attempt.durationMs)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
