import { useCallback, useEffect, useRef, useState } from "react";
import { markActivityDifficulty } from "@/actions/review";
import type { Activity } from "@/components/activities-data-table";
import type { RatingValue } from "@/components/rating-buttons";
import SequenceRunner from "@/components/sequence-runner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SequenceRunnerDialogProps {
  group: Activity | null;
  onOpenChange: (open: boolean) => void;
  /** After the sequence was rated: its row and the locks may change. */
  onRated: () => void;
  open: boolean;
}

/**
 * Doing a sequence from its module's table
 * (docs/specs/sequences-and-locks.md §5 AC-1, AC-2): its steps in order,
 * then its one rating, saved here.
 */
export default function SequenceRunnerDialog({
  group,
  onOpenChange,
  onRated,
  open,
}: SequenceRunnerDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setSaveFailed(false);
    }
  }, [open]);

  const handleRate = useCallback(
    (rating: RatingValue) => {
      if (!group || isSavingRef.current) {
        return;
      }
      isSavingRef.current = true;
      setIsSaving(true);
      Promise.resolve(markActivityDifficulty(group.id, rating))
        .then(() => {
          onOpenChange(false);
          onRated();
        })
        .catch(() => setSaveFailed(true))
        .finally(() => {
          isSavingRef.current = false;
          setIsSaving(false);
        });
    },
    [group, onOpenChange, onRated]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{group?.title}</DialogTitle>
        </DialogHeader>
        {group ? (
          <SequenceRunner
            group={group}
            isSaving={isSaving}
            key={group.id}
            onRate={handleRate}
            saveFailed={saveFailed}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
