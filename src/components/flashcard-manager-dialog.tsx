import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createFlashcard,
  listFlashcards,
  softDeleteFlashcard,
  updateFlashcard,
} from "@/actions/flashcards";
import type { Activity } from "@/components/activities-data-table";
import FlashcardFormDialog, {
  type FlashcardFormSubmitValue,
  type FlashcardFormValue,
} from "@/components/flashcard-form-dialog";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownContent from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Flashcard {
  back: string;
  backImagePath: string | null;
  front: string;
  frontImagePath: string | null;
  id: string;
}

interface FlashcardRowProps {
  deleteLabel: string;
  editLabel: string;
  flashcard: Flashcard;
  onDelete: (flashcard: Flashcard) => void;
  onEdit: (flashcard: Flashcard) => void;
}

function FlashcardRow({
  deleteLabel,
  editLabel,
  flashcard,
  onDelete,
  onEdit,
}: FlashcardRowProps) {
  const handleEditClick = useCallback(() => {
    onEdit(flashcard);
  }, [onEdit, flashcard]);

  const handleDeleteClick = useCallback(() => {
    onDelete(flashcard);
  }, [onDelete, flashcard]);

  return (
    <li className="flex items-center justify-between gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <MarkdownContent content={flashcard.front} />
          <ImageAttachmentViewer fileName={flashcard.frontImagePath} />
        </div>
        <div className="flex items-center gap-2">
          <MarkdownContent
            className="text-muted-foreground"
            content={flashcard.back}
          />
          <ImageAttachmentViewer fileName={flashcard.backImagePath} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          aria-label={editLabel}
          onClick={handleEditClick}
          size="icon"
          variant="ghost"
        >
          <Pencil />
        </Button>
        <Button
          aria-label={deleteLabel}
          onClick={handleDeleteClick}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

interface FlashcardManagerDialogProps {
  activity: Activity | null;
  /** The program's color, for the card in the flashcard form. */
  color?: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /**
   * Opens the new-item form right away (docs/specs/flashcard-editor-and-creation-flow.md
   * AC-1/AC-2): right after the activity is created, writing its first item
   * is the next step.
   */
  startWithNewItem?: boolean;
}

export default function FlashcardManagerDialog({
  activity,
  color = null,
  onOpenChange,
  open,
  startWithNewItem = false,
}: FlashcardManagerDialogProps) {
  const { t } = useTranslation();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [formFlashcard, setFormFlashcard] = useState<FlashcardFormValue | null>(
    null
  );
  const [isFormOpen, setIsFormOpen] = useState(false);

  const refreshFlashcards = useCallback(() => {
    if (!activity) {
      return;
    }

    listFlashcards(activity.id).then(setFlashcards);
  }, [activity]);

  useEffect(() => {
    refreshFlashcards();
  }, [refreshFlashcards]);

  useEffect(() => {
    if (open && startWithNewItem) {
      setFormFlashcard(null);
      setIsFormOpen(true);
    }
  }, [open, startWithNewItem]);

  const handleAddClick = useCallback(() => {
    setFormFlashcard(null);
    setIsFormOpen(true);
  }, []);

  const handleEditClick = useCallback((flashcard: Flashcard) => {
    setFormFlashcard(flashcard);
    setIsFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback(
    (flashcard: Flashcard) => {
      Promise.resolve(softDeleteFlashcard(flashcard.id)).then(() => {
        refreshFlashcards();
      });
    },
    [refreshFlashcards]
  );

  const handleFormOpenChange = useCallback((nextOpen: boolean) => {
    setIsFormOpen(nextOpen);
  }, []);

  /**
   * Saves one card from FlashcardFormDialog, which stays open to write the
   * next one and closes itself (docs/specs/flashcard-editor-and-creation-flow.md).
   */
  const handleFormSubmit = useCallback(
    async (flashcardId: string | null, values: FlashcardFormSubmitValue) => {
      if (!activity) {
        return;
      }

      if (flashcardId) {
        await updateFlashcard(flashcardId, values);
      } else {
        await createFlashcard(activity.id, values);
      }
      refreshFlashcards();
    },
    [activity, refreshFlashcards]
  );

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activity?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex justify-end">
              <Button onClick={handleAddClick}>
                {t("addFlashcardAction")}
              </Button>
            </div>
            {flashcards.length === 0 ? (
              <p>{t("flashcardsEmptyMessage")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {flashcards.map((flashcard) => (
                  <FlashcardRow
                    deleteLabel={t("deleteFlashcardAction")}
                    editLabel={t("editFlashcardAction")}
                    flashcard={flashcard}
                    key={flashcard.id}
                    onDelete={handleDeleteClick}
                    onEdit={handleEditClick}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <FlashcardFormDialog
        color={color}
        flashcard={formFlashcard}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
      />
    </>
  );
}
