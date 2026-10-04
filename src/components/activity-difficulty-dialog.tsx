import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearPendingActivityRating,
  markActivityDifficulty,
  previewActivityRatings,
  type RatingValue,
} from "@/actions/review";
import { RatingButtons, RatingSaveError } from "@/components/rating-buttons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ActivityDifficultyDialogProps {
  activityId: string | null;
  activityTitle: string;
  moduleName: string;
  onOpenChange: (open: boolean) => void;
  onRated: () => void;
  open: boolean;
  programName: string;
}

/**
 * One review_item per whole Activity (Issue #77): unlike
 * ReviewSessionDialog (a queue of Flashcards, each revealed before rating),
 * this is a single Again/Hard/Good/Easy step for the Activity as a whole --
 * no "reveal answer" step, since there is no answer to reveal here.
 *
 * Takes primitives (activityId/activityTitle/programName/moduleName)
 * instead of a whole Activity (Issue #103): it's now opened both from the
 * Activities route (which has a full Activity in hand) and from the app
 * root on launch (which only has what getPendingActivityRating() returns --
 * no filePath/url/moduleId, just enough to display and rate).
 */
export default function ActivityDifficultyDialog({
  activityId,
  activityTitle,
  moduleName,
  onOpenChange,
  onRated,
  open,
  programName,
}: ActivityDifficultyDialogProps) {
  const { t } = useTranslation();
  // What each rating would schedule (docs/specs/rating-clarity.md AC-1).
  const [intervals, setIntervals] = useState<
    Partial<Record<RatingValue, Date>> | undefined
  >();

  // A failed save keeps the dialog open (docs/specs/review-focus-errors.md AC-3, AC-4).
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    setIntervals(undefined);
    setSaveFailed(false);
    if (open && activityId) {
      previewActivityRatings(activityId)
        .then(setIntervals)
        .catch(() => undefined);
    }
  }, [activityId, open]);

  const handleRatingClick = useCallback(
    (rating: RatingValue) => {
      if (!activityId || isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      Promise.resolve(markActivityDifficulty(activityId, rating))
        .then(() => {
          clearPendingActivityRating(activityId);
          onOpenChange(false);
          onRated();
        })
        .catch(() => setSaveFailed(true))
        .finally(() => {
          isSavingRef.current = false;
          setIsSaving(false);
        });
    },
    [activityId, onOpenChange, onRated]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {/* Wide enough for the activity words in any language and text size
          (docs/specs/rating-dialog-overflow.md). */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{activityTitle}</DialogTitle>
          <DialogDescription>
            {t("activityDifficultyContextLabel", { moduleName, programName })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {t("activityDifficultyPromptMessage")}
        </p>
        {saveFailed ? <RatingSaveError /> : null}
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          data-slot="rating-grid"
        >
          {open ? (
            <RatingButtons
              disabled={isSaving}
              intervals={intervals}
              onRate={handleRatingClick}
              scale="activity"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
