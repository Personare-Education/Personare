import { toast } from "sonner";

const UNDO_WINDOW_MS = 8000;

interface UndoToastOptions {
  /** What was just deleted ("Question deleted"). */
  message: string;
  onUndo: () => void;
  undoLabel: string;
}

/**
 * The safety net after a deletion (docs/specs/safety-net.md AC-1): a short
 * notice with an Undo that brings the item back.
 */
export function showUndoToast({
  message,
  onUndo,
  undoLabel,
}: UndoToastOptions) {
  toast(message, {
    action: { label: undoLabel, onClick: onUndo },
    duration: UNDO_WINDOW_MS,
  });
}
