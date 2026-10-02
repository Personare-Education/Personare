import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ensureReviewItems, listDue, submitRating } from "@/actions/review";
import type { Activity } from "@/components/activities-data-table";
import FlipCard from "@/components/flip-card";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownContent from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveProgramColor } from "@/constants/program-appearance";

interface DueReviewItem {
  back: string;
  backImagePath: string | null;
  dueDate: Date;
  front: string;
  frontImagePath: string | null;
  id: string;
}

type RatingValue = "again" | "hard" | "good" | "easy";

const RATINGS: RatingValue[] = ["again", "hard", "good", "easy"];

const RATING_TRANSLATION_KEYS: Record<RatingValue, string> = {
  again: "ratingAgainAction",
  easy: "ratingEasyAction",
  good: "ratingGoodAction",
  hard: "ratingHardAction",
};

interface RatingButtonProps {
  label: string;
  onClick: (rating: RatingValue) => void;
  rating: RatingValue;
}

function RatingButton({ label, onClick, rating }: RatingButtonProps) {
  const handleClick = useCallback(() => {
    onClick(rating);
  }, [onClick, rating]);

  return <Button onClick={handleClick}>{label}</Button>;
}

interface ReviewSessionDialogProps {
  activity: Activity | null;
  /** The program's color, for the card. */
  color?: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export default function ReviewSessionDialog({
  activity,
  color = null,
  onOpenChange,
  open,
}: ReviewSessionDialogProps) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<DueReviewItem[]>([]);
  const [initialCount, setInitialCount] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  // Which face the card shows: the back once revealed, but the user can flip
  // back to the front to read the question again.
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (open) {
      setIsRevealed(false);
      setIsFlipped(false);
    }
  }, [open]);

  useEffect(() => {
    if (activity) {
      ensureReviewItems(activity.id)
        .then(() => listDue(activity.id))
        .then((items) => {
          setQueue(items);
          setInitialCount(items.length);
        });
    }
  }, [activity]);

  const currentItem = queue[0] ?? null;

  const handleRevealClick = useCallback(() => {
    setIsRevealed(true);
    setIsFlipped(true);
  }, []);

  // Clicking the card reveals the answer, then flips between its faces.
  const handleCardFlip = useCallback(() => {
    if (isRevealed) {
      setIsFlipped((prev) => !prev);
    } else {
      setIsRevealed(true);
      setIsFlipped(true);
    }
  }, [isRevealed]);

  const handleRatingClick = useCallback(
    (rating: RatingValue) => {
      if (!currentItem) {
        return;
      }

      Promise.resolve(submitRating(currentItem.id, rating)).then(() => {
        setQueue((prev) => prev.slice(1));
        setIsRevealed(false);
        setIsFlipped(false);
      });
    },
    [currentItem]
  );

  const nothingDue = initialCount === 0;
  const sessionComplete =
    initialCount !== null && initialCount > 0 && queue.length === 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
        </DialogHeader>
        {nothingDue ? <p>{t("reviewNothingDueMessage")}</p> : null}
        {sessionComplete ? <p>{t("reviewSessionCompleteMessage")}</p> : null}
        {currentItem ? (
          <div className="flex flex-col gap-3 py-4">
            {/* Keyed by item: the next card shows up on its front, instead of
                flipping back through its own back (AC-13). */}
            <FlipCard
              back={
                isRevealed ? (
                  <MarkdownContent
                    className="text-base"
                    content={currentItem.back}
                  />
                ) : null
              }
              backLabel={t("flashcardBackLabel")}
              color={resolveProgramColor(color)}
              flipped={isFlipped}
              front={
                <MarkdownContent
                  className="text-base"
                  content={currentItem.front}
                />
              }
              frontLabel={t("flashcardFrontLabel")}
              hint={t("flashcardFlipHint")}
              key={currentItem.id}
              onFlip={handleCardFlip}
            />
            <div className="flex min-h-7 items-center justify-center gap-2">
              <ImageAttachmentViewer
                fileName={
                  isFlipped
                    ? currentItem.backImagePath
                    : currentItem.frontImagePath
                }
              />
            </div>
          </div>
        ) : null}
        {currentItem ? (
          <DialogFooter>
            {isRevealed ? (
              RATINGS.map((rating) => (
                <RatingButton
                  key={rating}
                  label={t(RATING_TRANSLATION_KEYS[rating])}
                  onClick={handleRatingClick}
                  rating={rating}
                />
              ))
            ) : (
              <Button onClick={handleRevealClick}>
                {t("revealAnswerAction")}
              </Button>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
