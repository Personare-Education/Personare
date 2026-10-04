import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  markActivityDifficulty,
  previewActivityRatings,
} from "@/actions/review";
import { openActivityFile, openExternalLink } from "@/actions/shell";
import type { Activity } from "@/components/activities-data-table";
import FlashcardReviewPanel from "@/components/flashcard-review-panel";
import QuizRunnerDialog from "@/components/quiz-runner-dialog";
import {
  RatingButtons,
  RatingSaveError,
  type RatingValue,
} from "@/components/rating-buttons";
import SessionEndCard from "@/components/session-end-card";
import TodayItemCard from "@/components/today-item-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { resolveProgramColor } from "@/constants/program-appearance";
import type { TodayItem } from "@/utils/today-queue";

/** Where an opened activity is: about to be opened, or waiting for its rating. */
type ActivityStep = "open" | "rate";

function toActivity(item: TodayItem): Activity {
  const now = new Date();
  return {
    createdAt: now,
    filePath: item.activityFilePath,
    id: item.activityId,
    moduleId: item.moduleId,
    title: item.activityTitle,
    type: item.activityType,
    updatedAt: now,
    url: item.activityUrl,
  };
}

interface ActivityStepProps {
  isSaving: boolean;
  item: TodayItem;
  onRate: (rating: RatingValue) => void;
  saveFailed: boolean;
}

/**
 * A PDF, a link or a quiz in the session (AC-5): opened from here, then
 * rated right here once the student is back.
 */
function ActivityStepPanel({
  isSaving,
  item,
  onRate,
  saveFailed,
}: ActivityStepProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ActivityStep>("open");
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [intervals, setIntervals] = useState<
    Partial<Record<RatingValue, Date>> | undefined
  >();

  // What each rating would schedule (docs/specs/rating-clarity.md AC-1).
  useEffect(() => {
    if (step === "rate") {
      previewActivityRatings(item.activityId)
        .then(setIntervals)
        .catch(() => undefined);
    }
  }, [item.activityId, step]);

  const handleOpenClick = useCallback(() => {
    if (item.activityType === "quiz") {
      setIsQuizOpen(true);
      return;
    }
    if (item.activityType === "pdf" && item.activityFilePath) {
      openActivityFile(item.activityFilePath);
    } else if (item.activityType === "link" && item.activityUrl) {
      openExternalLink(item.activityUrl);
    }
    setStep("rate");
  }, [item]);

  const handleQuizFinished = useCallback(() => {
    setIsQuizOpen(false);
    setStep("rate");
  }, []);

  const handleQuizOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setIsQuizOpen(false);
    }
  }, []);

  let openLabel = t("todayOpenLinkAction");
  if (item.activityType === "pdf") {
    openLabel = t("todayOpenPdfAction");
  } else if (item.activityType === "quiz") {
    openLabel = t("takeQuizAction");
  }

  return (
    <div className="flex flex-col gap-4">
      <TodayItemCard item={item} />
      {step === "rate" ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {t("todayRatePrompt")}
          </p>
          {saveFailed ? <RatingSaveError /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {/* Focus follows the step, off the open button that just went
                (docs/specs/review-focus-errors.md AC-2). */}
            <RatingButtons
              autoFocus
              disabled={isSaving}
              intervals={intervals}
              onRate={onRate}
              scale="activity"
            />
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button onClick={handleOpenClick}>{openLabel}</Button>
        </div>
      )}
      {item.activityType === "quiz" ? (
        <QuizRunnerDialog
          activity={isQuizOpen ? toActivity(item) : null}
          onFinished={handleQuizFinished}
          onOpenChange={handleQuizOpenChange}
          open={isQuizOpen}
        />
      ) : null}
    </div>
  );
}

interface ProgramTally {
  color: string | null;
  count: number;
  name: string;
}

/**
 * What a finished session reviewed, one row per program in its color
 * (docs/specs/bolder-cards.md AC-2). Skipped items are not in `items`.
 */
function ReviewedByProgram({ items }: { items: TodayItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return null;
  }

  const tallies = new Map<string, ProgramTally>();
  for (const item of items) {
    const tally = tallies.get(item.programId) ?? {
      color: item.programColor,
      count: 0,
      name: item.programName,
    };
    tally.count += 1;
    tallies.set(item.programId, tally);
  }

  return (
    <ul
      aria-label={t("todaySessionByProgramLabel")}
      className="flex flex-col gap-1.5 border-foreground/10 border-t pt-3"
    >
      {Array.from(tallies, ([programId, tally]) => (
        <li className="flex items-center gap-2 text-sm" key={programId}>
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: resolveProgramColor(tally.color) }}
          />
          <span className="min-w-0 flex-1 truncate">{tally.name}</span>
          <span className="text-foreground/70 tabular-nums">
            {t("todaySessionProgramCount", { count: tally.count })}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface TodaySessionDialogProps {
  items: TodayItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/**
 * The "Start" session of the Today screen (docs/specs/today-review-queue.md
 * AC-5..7): the day's items one at a time, with progress and Skip. Every
 * rating is saved as it happens, so closing halfway loses nothing.
 */
export default function TodaySessionDialog({
  items,
  onOpenChange,
  open,
}: TodaySessionDialogProps) {
  const { t } = useTranslation();
  // The queue as it was when the session started: the screen behind keeps
  // refreshing as reviews are done, and must not reshuffle the session.
  const [queue, setQueue] = useState<TodayItem[]>(items);
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState<TodayItem[]>([]);
  // One activity rating in flight; a failed save keeps the item
  // (docs/specs/review-focus-errors.md AC-3, AC-4).
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isSavingRef = useRef(false);

  // Only when the session (re)opens: later updates of `items` are the
  // screen refreshing behind it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    if (open) {
      setQueue(items);
      setIndex(0);
      setReviewed([]);
    }
  }, [open]);

  const current = queue[index] ?? null;
  const isDone = queue.length > 0 && index >= queue.length;

  const advance = useCallback(() => {
    setSaveFailed(false);
    setIndex((prev) => prev + 1);
  }, []);

  const handleActivityRate = useCallback(
    (rating: RatingValue) => {
      if (!current || isSavingRef.current) {
        return;
      }
      isSavingRef.current = true;
      setIsSaving(true);
      Promise.resolve(markActivityDifficulty(current.activityId, rating))
        .then(() => {
          setReviewed((prev) => [...prev, current]);
          advance();
        })
        .catch(() => setSaveFailed(true))
        .finally(() => {
          isSavingRef.current = false;
          setIsSaving(false);
        });
    },
    [advance, current]
  );

  const handleDeckDone = useCallback(
    (ratedCount: number) => {
      if (ratedCount > 0 && current) {
        setReviewed((prev) => [...prev, current]);
      }
      advance();
    },
    [advance, current]
  );

  const handleCloseClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("todaySessionTitle")}</DialogTitle>
        </DialogHeader>
        {current ? (
          <>
            <div className="flex flex-col gap-2">
              {/* The bar shows the same position as "1 of 2"
                  (docs/specs/clarify-daily-count.md AC-3). */}
              <Progress value={((index + 1) / queue.length) * 100} />
              <p className="text-muted-foreground text-xs tabular-nums">
                {t("todaySessionProgress", {
                  current: index + 1,
                  total: queue.length,
                })}
              </p>
            </div>
            {/* Bleeds into the dialog's padding, so the cards' ring and glow
                are not clipped by the scroll area. */}
            <div className="-mx-4 -my-3 min-h-0 overflow-y-auto px-4 py-3 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
              {current.activityType === "flashcard_deck" ? (
                <div className="flex flex-col gap-3">
                  <TodayItemCard compact item={current} />
                  <FlashcardReviewPanel
                    activityId={current.activityId}
                    // As wide as the item's card above it.
                    cardClassName="max-w-none"
                    color={current.programColor}
                    key={current.activityId}
                    onDone={handleDeckDone}
                  />
                </div>
              ) : (
                <ActivityStepPanel
                  isSaving={isSaving}
                  item={current}
                  key={current.activityId}
                  onRate={handleActivityRate}
                  saveFailed={saveFailed}
                />
              )}
            </div>
            <DialogFooter className="sm:justify-start">
              <Button onClick={advance} variant="ghost">
                {t("todaySkipAction")}
              </Button>
            </DialogFooter>
          </>
        ) : null}
        {isDone ? (
          <div className="flex flex-col gap-4">
            <SessionEndCard
              color="var(--brand)"
              title={t("todaySessionDoneTitle")}
            >
              <p className="text-foreground/75 text-sm">
                {t("todaySessionDoneMessage", { count: reviewed.length })}
              </p>
              <ReviewedByProgram items={reviewed} />
            </SessionEndCard>
            <DialogFooter>
              <Button onClick={handleCloseClick}>
                {t("concludeQuizEditingAction")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
