import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { markActivityDifficulty } from "@/actions/review";
import { openActivityFile, openExternalLink } from "@/actions/shell";
import type { Activity } from "@/components/activities-data-table";
import FlashcardReviewPanel from "@/components/flashcard-review-panel";
import QuizRunnerDialog from "@/components/quiz-runner-dialog";
import { RatingButtons, type RatingValue } from "@/components/rating-buttons";
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
  item: TodayItem;
  onRate: (rating: RatingValue) => void;
}

/**
 * A PDF, a link or a quiz in the session (AC-5): opened from here, then
 * rated right here once the student is back.
 */
function ActivityStepPanel({ item, onRate }: ActivityStepProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ActivityStep>("open");
  const [isQuizOpen, setIsQuizOpen] = useState(false);

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
          <div className="flex flex-wrap justify-end gap-2">
            <RatingButtons onRate={onRate} />
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
  const [reviewedCount, setReviewedCount] = useState(0);

  // Only when the session (re)opens: later updates of `items` are the
  // screen refreshing behind it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    if (open) {
      setQueue(items);
      setIndex(0);
      setReviewedCount(0);
    }
  }, [open]);

  const current = queue[index] ?? null;
  const isDone = queue.length > 0 && index >= queue.length;

  const advance = useCallback(() => {
    setIndex((prev) => prev + 1);
  }, []);

  const handleActivityRate = useCallback(
    (rating: RatingValue) => {
      if (!current) {
        return;
      }
      markActivityDifficulty(current.activityId, rating).then(() => {
        setReviewedCount((prev) => prev + 1);
        advance();
      });
    },
    [advance, current]
  );

  const handleDeckDone = useCallback(
    (ratedCount: number) => {
      if (ratedCount > 0) {
        setReviewedCount((prev) => prev + 1);
      }
      advance();
    },
    [advance]
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
              <Progress value={(index / queue.length) * 100} />
              <p className="text-muted-foreground text-xs tabular-nums">
                {t("todaySessionProgress", {
                  current: index + 1,
                  total: queue.length,
                })}
              </p>
            </div>
            <div className="min-h-0 overflow-y-auto">
              {current.activityType === "flashcard_deck" ? (
                <div className="flex flex-col gap-3">
                  <TodayItemCard compact item={current} />
                  <FlashcardReviewPanel
                    activityId={current.activityId}
                    color={current.programColor}
                    key={current.activityId}
                    onDone={handleDeckDone}
                  />
                </div>
              ) : (
                <ActivityStepPanel
                  item={current}
                  key={current.activityId}
                  onRate={handleActivityRate}
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
          <div className="flex flex-col items-start gap-2 py-2">
            <p className="font-medium font-serif text-2xl">
              {t("todaySessionDoneTitle")}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("todaySessionDoneMessage", { count: reviewedCount })}
            </p>
            <DialogFooter className="w-full">
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
