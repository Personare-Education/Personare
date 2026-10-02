import type { Activity } from "@/components/activities-data-table";
import FlashcardReviewPanel from "@/components/flashcard-review-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReviewSessionDialogProps {
  activity: Activity | null;
  /** The program's color, for the card. */
  color?: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/** A deck's review, on its own (the activity row's "Start review"). */
export default function ReviewSessionDialog({
  activity,
  color = null,
  onOpenChange,
  open,
}: ReviewSessionDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activity?.title}</DialogTitle>
        </DialogHeader>
        {activity && open ? (
          <FlashcardReviewPanel
            activityId={activity.id}
            color={color}
            showEndMessages
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
