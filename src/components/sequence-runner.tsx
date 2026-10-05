import { FileText, Link, ListChecks, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { completeActivity, listActivities } from "@/actions/activities";
import { listLocks, previewActivityRatings } from "@/actions/review";
import { openActivityFile, openExternalLink } from "@/actions/shell";
import type { Activity } from "@/components/activities-data-table";
import LockLabel from "@/components/lock-label";
import QuizRunnerDialog from "@/components/quiz-runner-dialog";
import {
  RatingButtons,
  RatingSaveError,
  type RatingValue,
} from "@/components/rating-buttons";
import { Button } from "@/components/ui/button";
import { describeLock } from "@/utils/lock-text";
import type { LockState, Locks } from "@/utils/unlock";

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

const OPEN_LABEL_KEYS: Record<string, string> = {
  link: "todayOpenLinkAction",
  pdf: "todayOpenPdfAction",
  quiz: "takeQuizAction",
};

interface SequenceRunnerProps {
  group: { id: string; moduleId: string; title: string };
  isSaving: boolean;
  /** The one rating of the whole sequence, at the end (§5 AC-5). */
  onRate: (rating: RatingValue) => void;
  saveFailed: boolean;
}

const NO_LOCKS: Locks = { activities: {}, modules: {} };

/**
 * Doing a sequence (docs/specs/sequences-and-locks.md §5): its activities
 * one at a time, in order, each opened and concluded (or, when its own rule
 * still locks it, skipped), then one rating for the whole sequence.
 */
export default function SequenceRunner({
  group,
  isSaving,
  onRate,
  saveFailed,
}: SequenceRunnerProps) {
  const { t } = useTranslation();
  const [steps, setSteps] = useState<Activity[] | null>(null);
  const [index, setIndex] = useState(0);
  const [isOpened, setIsOpened] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [locks, setLocks] = useState<Locks>(NO_LOCKS);
  const [intervals, setIntervals] = useState<
    Partial<Record<RatingValue, Date>> | undefined
  >();

  const refreshLocks = useCallback(() => {
    listLocks()
      .then(setLocks)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setSteps(null);
    setIndex(0);
    setIsOpened(false);
    listActivities(group.moduleId, group.id).then(setSteps);
    refreshLocks();
  }, [group.id, group.moduleId, refreshLocks]);

  const current = steps?.[index] ?? null;
  const isRating = steps !== null && index >= steps.length;
  const currentLock = current ? locks.activities[current.id] : undefined;

  // What each rating would schedule for the sequence (rating-clarity AC-1).
  useEffect(() => {
    if (isRating) {
      previewActivityRatings(group.id)
        .then(setIntervals)
        .catch(() => undefined);
    }
  }, [group.id, isRating]);

  const advance = useCallback(() => {
    setIsOpened(false);
    setIndex((prev) => prev + 1);
  }, []);

  const conclude = useCallback(
    (stepId: string) => {
      completeActivity(stepId).then(() => {
        // Concluding one may unlock the next (§5 AC-2).
        refreshLocks();
        advance();
      });
    },
    [advance, refreshLocks]
  );

  const handleOpenClick = useCallback(() => {
    if (!current) {
      return;
    }
    if (current.type === "quiz") {
      setIsQuizOpen(true);
      return;
    }
    if (current.type === "pdf" && current.filePath) {
      openActivityFile(current.filePath);
    } else if (current.type === "link" && current.url) {
      openExternalLink(current.url);
    }
    setIsOpened(true);
  }, [current]);

  const handleConcludeClick = useCallback(() => {
    if (current) {
      conclude(current.id);
    }
  }, [conclude, current]);

  // The quiz's Continue concludes its step (§5 AC-3).
  const handleQuizFinished = useCallback(
    (quiz: Activity) => {
      setIsQuizOpen(false);
      conclude(quiz.id);
    },
    [conclude]
  );

  const handleQuizOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setIsQuizOpen(false);
    }
  }, []);

  if (steps === null) {
    return null;
  }

  if (isRating || !current) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          {t("sequenceRatePrompt")}
        </p>
        {saveFailed ? <RatingSaveError /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <RatingButtons
            autoFocus
            disabled={isSaving}
            intervals={intervals}
            onRate={onRate}
            scale="activity"
          />
        </div>
      </div>
    );
  }

  return (
    <SequenceStep
      isOpened={isOpened}
      isQuizOpen={isQuizOpen}
      lock={currentLock}
      names={Object.fromEntries(steps.map((row) => [row.id, row.title]))}
      onConclude={handleConcludeClick}
      onOpen={handleOpenClick}
      onQuizFinished={handleQuizFinished}
      onQuizOpenChange={handleQuizOpenChange}
      onSkip={advance}
      position={index + 1}
      step={current}
      total={steps.length}
    />
  );
}

interface SequenceStepProps {
  isOpened: boolean;
  isQuizOpen: boolean;
  lock: LockState | undefined;
  /** Every step's title, for what a lock is missing. */
  names: Record<string, string>;
  onConclude: () => void;
  onOpen: () => void;
  onQuizFinished: (quiz: Activity) => void;
  onQuizOpenChange: (open: boolean) => void;
  onSkip: () => void;
  position: number;
  step: Activity;
  total: number;
}

/** One step: what it is, then open it, conclude it, or skip it if locked. */
function SequenceStep({
  isOpened,
  isQuizOpen,
  lock,
  names,
  onConclude,
  onOpen,
  onQuizFinished,
  onQuizOpenChange,
  onSkip,
  position,
  step,
  total,
}: SequenceStepProps) {
  const { i18n, t } = useTranslation();
  const Icon = STEP_ICONS[step.type] ?? FileText;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs tabular-nums">
        {t("sequenceStepProgress", { current: position, total })}
      </p>
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <Icon
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium font-serif text-lg leading-snug">
            {step.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
            {t(STEP_TYPE_LABEL_KEYS[step.type] ?? "activityTypeLabel")}
            {lock ? (
              <LockLabel
                label={describeLock(
                  t,
                  i18n.language,
                  lock,
                  step.unlockMode ?? "none",
                  names
                )}
              />
            ) : null}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {lock ? (
          // Still locked by its own rule: it can only be skipped (§5 AC-4).
          <Button onClick={onSkip} variant="outline">
            {t("skipStepAction")}
          </Button>
        ) : null}
        {!lock && isOpened ? (
          <Button onClick={onConclude}>{t("concludeStepAction")}</Button>
        ) : null}
        {lock || isOpened ? null : (
          <Button onClick={onOpen}>
            {t(OPEN_LABEL_KEYS[step.type] ?? "todayOpenLinkAction")}
          </Button>
        )}
      </div>
      {step.type === "quiz" ? (
        <QuizRunnerDialog
          activity={isQuizOpen ? step : null}
          asStep
          onFinished={onQuizFinished}
          onOpenChange={onQuizOpenChange}
          open={isQuizOpen}
        />
      ) : null}
    </div>
  );
}
