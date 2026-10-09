import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ensureReviewItems,
  listDue,
  previewItemRatings,
  submitRating,
} from "@/actions/review";
import FlipCard from "@/components/flip-card";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import KeyHint from "@/components/key-hint";
import MarkdownContent from "@/components/markdown-content";
import {
  isTypingTarget,
  RatingButtons,
  RatingSaveError,
  type RatingValue,
} from "@/components/rating-buttons";
import SessionEndCard from "@/components/session-end-card";
import { Button } from "@/components/ui/button";
import { resolveProgramColor } from "@/constants/program-appearance";
import { returnsThisSession } from "@/utils/review-time";

interface DueReviewItem {
  back: string;
  backImagePath: string | null;
  dueDate: Date;
  front: string;
  frontImagePath: string | null;
  id: string;
}

interface FlashcardReviewPanelProps {
  activityId: string;
  /** Classes for the flipping card, e.g. to span the full width. */
  cardClassName?: string;
  /** The program's color, for the card. */
  color?: string | null;
  /** Once the deck's due cards are done (or there were none), with how many were rated. */
  onDone?: (ratedCount: number) => void;
  /** Show "session complete" / "nothing due" instead of handing back. */
  showEndMessages?: boolean;
}

/**
 * One deck's review (docs/specs/today-review-queue.md AC-5): its due cards
 * one by one on the flipping card, revealed with the button, a click on the
 * card or Space, and rated with the buttons or the keys 1-4. Used by the
 * deck's own review dialog and by the "Today" session.
 */
/** Longer than this, the student most likely left the screen: not measured. */
const MAX_MEASURED_REVIEW_MS = 15 * 60 * 1000;

export function reviewDuration(shownAt: number, ratedAt: number) {
  const duration = ratedAt - shownAt;
  return duration >= 0 && duration <= MAX_MEASURED_REVIEW_MS
    ? duration
    : undefined;
}

export default function FlashcardReviewPanel({
  activityId,
  cardClassName,
  color = null,
  onDone,
  showEndMessages = false,
}: FlashcardReviewPanelProps) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<DueReviewItem[]>([]);
  const [initialCount, setInitialCount] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  // Which face the card shows: the back once revealed, but the user can flip
  // back to the front to read the question again.
  const [isFlipped, setIsFlipped] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // Each card counts once, even when it came back in the session
  // (docs/specs/relearn-in-session.md AC-5).
  const ratedIdsRef = useRef(new Set<string>());
  // One rating in flight at a time; a failed save keeps the card
  // (docs/specs/review-focus-errors.md AC-3, AC-4).
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    setQueue([]);
    setInitialCount(null);
    setIsRevealed(false);
    setIsFlipped(false);
    ratedIdsRef.current = new Set();
    ensureReviewItems(activityId)
      .then(() => listDue(activityId))
      .then((items) => {
        setQueue(items);
        setInitialCount(items.length);
        if (items.length === 0) {
          onDoneRef.current?.(0);
        }
      });
  }, [activityId]);

  const currentItem = queue[0] ?? null;
  // When the card showed up, for how long its review took
  // (docs/architecture/scheduling.md D3).
  const shownAtRef = useRef(Date.now());
  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts the clock for each card shown
  useEffect(() => {
    shownAtRef.current = Date.now();
  }, [currentItem?.id]);
  // What each rating would schedule for this card (docs/specs/rating-clarity.md AC-1).
  const [intervals, setIntervals] = useState<
    Partial<Record<RatingValue, Date>> | undefined
  >();

  useEffect(() => {
    setIntervals(undefined);
    if (currentItem && isRevealed) {
      previewItemRatings(currentItem.id)
        .then(setIntervals)
        .catch(() => undefined);
    }
  }, [currentItem, isRevealed]);

  const reveal = useCallback(() => {
    setIsRevealed(true);
    setIsFlipped(true);
  }, []);

  // Clicking the card reveals the answer, then flips between its faces.
  const handleCardFlip = useCallback(() => {
    if (isRevealed) {
      setIsFlipped((prev) => !prev);
    } else {
      reveal();
    }
  }, [isRevealed, reveal]);

  // Space reveals (AC-7), unless something focused already handled it.
  useEffect(() => {
    if (!currentItem || isRevealed) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key !== " " ||
        event.defaultPrevented ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      reveal();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentItem, isRevealed, reveal]);

  const handleRate = useCallback(
    (rating: RatingValue) => {
      if (!currentItem || isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      Promise.resolve(
        submitRating(
          currentItem.id,
          rating,
          reviewDuration(shownAtRef.current, Date.now())
        )
      )
        .then((updated) => {
          setSaveFailed(false);
          ratedIdsRef.current.add(currentItem.id);
          // A short learning step ("Again · 1 minute") comes back at the end
          // of this session, as the button promised (AC-1).
          const dueDate = updated?.dueDate ? new Date(updated.dueDate) : null;
          const comesBack =
            dueDate !== null && returnsThisSession(dueDate, new Date());
          setIsRevealed(false);
          setIsFlipped(false);
          setQueue((prev) => {
            const next = prev.slice(1);
            if (comesBack) {
              next.push({ ...currentItem, dueDate });
            }
            if (next.length === 0) {
              onDoneRef.current?.(ratedIdsRef.current.size);
            }
            return next;
          });
        })
        .catch(() => setSaveFailed(true))
        .finally(() => {
          isSavingRef.current = false;
          setIsSaving(false);
        });
    },
    [currentItem]
  );

  const nothingDue = initialCount === 0;
  const sessionComplete =
    initialCount !== null && initialCount > 0 && queue.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {showEndMessages && nothingDue ? (
        <p>{t("reviewNothingDueMessage")}</p>
      ) : null}
      {showEndMessages && sessionComplete ? (
        // Every due card has to be rated to get here, so all of them were
        // (docs/specs/bolder-cards.md AC-3).
        <SessionEndCard
          color={resolveProgramColor(color)}
          title={t("reviewSessionCompleteMessage")}
        >
          <p className="text-foreground/75 text-sm">
            {t("reviewSessionCompleteCount", { count: initialCount })}
          </p>
        </SessionEndCard>
      ) : null}
      {currentItem ? (
        <>
          <div className="flex flex-col gap-3 py-2">
            {/* docs/specs/relearn-in-session.md AC-3 */}
            <p className="text-muted-foreground text-xs tabular-nums">
              {t("reviewCardsLeftLabel", { count: queue.length })}
            </p>
            {/* Keyed by item: the next card shows up on its front, instead of
                flipping back through its own back. */}
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
              className={cardClassName}
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
          {saveFailed ? <RatingSaveError /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {isRevealed ? (
              <RatingButtons
                autoFocus
                disabled={isSaving}
                intervals={intervals}
                onRate={handleRate}
              />
            ) : (
              <Button aria-keyshortcuts="Space" onClick={reveal}>
                {t("revealAnswerAction")}
                {/* docs/specs/key-hints.md AC-2 */}
                <KeyHint>{t("keySpaceLabel")}</KeyHint>
              </Button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
