import { Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import FlipCard from "@/components/flip-card";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownComposer from "@/components/markdown-composer";
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
import { useDialogShake } from "@/hooks/use-dialog-shake";

export interface FlashcardFormValue {
  back: string;
  backImagePath: string | null;
  front: string;
  frontImagePath: string | null;
  id: string;
}

export interface FlashcardFormSubmitValue {
  back: string;
  backImagePath: string | null;
  front: string;
  frontImagePath: string | null;
}

type Face = "back" | "front";

interface FaceContent {
  imagePath: string | null;
  text: string;
}

interface Faces {
  back: FaceContent | null;
  front: FaceContent | null;
}

const EMPTY_DRAFT: FaceContent = { imagePath: null, text: "" };
const EMPTY_FACES: Faces = { back: null, front: null };
const FADE_MS = 150;
function facesFromFlashcard(flashcard: FlashcardFormValue | null): Faces {
  if (!flashcard) {
    return EMPTY_FACES;
  }
  return {
    back: { imagePath: flashcard.backImagePath, text: flashcard.back },
    front: { imagePath: flashcard.frontImagePath, text: flashcard.front },
  };
}

function isDraftEmpty(draft: FaceContent) {
  return draft.text.trim() === "" && !draft.imagePath;
}

/** The face a submission fills: the edited one, else the first empty one. */
function targetFace(faces: Faces, editing: Face | null): Face | null {
  if (editing) {
    return editing;
  }
  if (!faces.front) {
    return "front";
  }
  if (!faces.back) {
    return "back";
  }
  return null;
}

function fade(element: HTMLElement | null, from: number, to: number) {
  if (!element?.animate) {
    return Promise.resolve();
  }
  return element
    .animate([{ opacity: from }, { opacity: to }], {
      duration: FADE_MS,
      easing: "ease-out",
      fill: "forwards",
    })
    .finished.then(() => undefined)
    .catch(() => undefined);
}

function FaceText({ content }: { content: FaceContent | null }) {
  const { t } = useTranslation();

  return content ? (
    <MarkdownContent className="text-base" content={content.text} />
  ) : (
    // Over the program's tint, like the other text on it
    // (docs/specs/contrast-translation.md AC-2).
    <span className="text-foreground/75 text-sm">
      {t("flashcardFaceEmptyMessage")}
    </span>
  );
}

interface FlashcardFormDialogProps {
  /** The program's color, for the card. */
  color?: string | null;
  flashcard: FlashcardFormValue | null;
  onOpenChange: (open: boolean) => void;
  /**
   * Saves one card: `flashcardId` is the card being edited, or null for a
   * new one. The dialog waits for it before moving on or closing.
   */
  onSubmit: (
    flashcardId: string | null,
    values: FlashcardFormSubmitValue
  ) => Promise<void> | void;
  open: boolean;
  /** How many cards the deck already has saved, for the footer. */
  savedCount?: number;
}

/**
 * Writes flashcards with a single Markdown editor
 * (docs/specs/flashcard-editor-and-creation-flow.md): its first submission
 * is the front, the second the back, shown on a card that flips around its
 * vertical axis when clicked. It only closes through "Done" or its X.
 */
export default function FlashcardFormDialog({
  color = null,
  flashcard,
  onOpenChange,
  onSubmit,
  open,
  savedCount,
}: FlashcardFormDialogProps) {
  const { t } = useTranslation();
  const { contentRef, isShaking, preventAndShake } =
    useDialogShake<HTMLDivElement>();
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [faces, setFaces] = useState<Faces>(() =>
    facesFromFlashcard(flashcard)
  );
  const [draft, setDraft] = useState<FaceContent>(EMPTY_DRAFT);
  const [stash, setStash] = useState<FaceContent>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Face | null>(null);
  const [showingBack, setShowingBack] = useState(false);
  const [flashcardId, setFlashcardId] = useState<string | null>(
    flashcard ? flashcard.id : null
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const reset = useCallback((next: FlashcardFormValue | null) => {
    setFaces(facesFromFlashcard(next));
    setDraft(EMPTY_DRAFT);
    setStash(EMPTY_DRAFT);
    setEditing(null);
    setShowingBack(false);
    setFlashcardId(next ? next.id : null);
    setError(null);
  }, []);

  useEffect(() => {
    if (open) {
      reset(flashcard);
    }
  }, [open, flashcard, reset]);

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  // Writing is what the dialog is for: open with the editor focused.
  const handleOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    textareaRef.current?.focus();
  }, []);

  const handleDraftTextChange = useCallback((text: string) => {
    setDraft((prev) => ({ ...prev, text }));
  }, []);

  const handleDraftImagePathChange = useCallback((imagePath: string | null) => {
    setDraft((prev) => ({ ...prev, imagePath }));
  }, []);

  const handleComposerSubmit = useCallback(() => {
    const target = targetFace(faces, editing);
    if (isDraftEmpty(draft) || !target) {
      return;
    }
    setFaces((prev) => ({ ...prev, [target]: draft }));
    setShowingBack(target === "back");
    setDraft(editing ? stash : EMPTY_DRAFT);
    setStash(EMPTY_DRAFT);
    setEditing(null);
    setError(null);
  }, [draft, editing, faces, stash]);

  const handleFlip = useCallback(() => {
    setShowingBack((prev) => !prev);
  }, []);

  const visibleFace: Face = showingBack ? "back" : "front";
  const visibleContent = faces[visibleFace];

  const handleEditClick = useCallback(() => {
    if (!visibleContent) {
      return;
    }
    if (!editing) {
      setStash(draft);
    }
    setEditing(visibleFace);
    setDraft(visibleContent);
    focusEditor();
  }, [draft, editing, focusEditor, visibleContent, visibleFace]);

  const handleCancelEdit = useCallback(() => {
    setDraft(stash);
    setStash(EMPTY_DRAFT);
    setEditing(null);
  }, [stash]);

  /**
   * AC-8/AC-9: what is still in the editor joins the card first; then it is
   * validated and saved.
   */
  const saveCurrent = useCallback(async (): Promise<
    "empty" | "invalid" | "saved"
  > => {
    let committed = faces;
    const target = targetFace(faces, editing);
    if (target && !isDraftEmpty(draft)) {
      committed = { ...committed, [target]: draft };
    }
    const stashTarget = targetFace(committed, null);
    if (stashTarget && !isDraftEmpty(stash)) {
      committed = { ...committed, [stashTarget]: stash };
    }
    setFaces(committed);
    setDraft(EMPTY_DRAFT);
    setStash(EMPTY_DRAFT);
    setEditing(null);

    if (!(committed.front || committed.back)) {
      return "empty";
    }
    if (!committed.front) {
      setError("flashcardFormMissingFrontError");
      return "invalid";
    }
    if (!committed.back) {
      setError("flashcardFormMissingBackError");
      return "invalid";
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSubmit(flashcardId, {
        back: committed.back.text,
        backImagePath: committed.back.imagePath,
        front: committed.front.text,
        frontImagePath: committed.front.imagePath,
      });
      return "saved";
    } finally {
      setIsSaving(false);
    }
  }, [draft, editing, faces, flashcardId, onSubmit, stash]);

  const handleAddFlashcardClick = useCallback(async () => {
    const outcome = await saveCurrent();
    if (outcome === "empty") {
      setError("flashcardFormMissingFrontError");
      return;
    }
    if (outcome !== "saved") {
      return;
    }
    await fade(bodyRef.current, 1, 0);
    reset(null);
    await fade(bodyRef.current, 0, 1);
    focusEditor();
  }, [focusEditor, reset, saveCurrent]);

  const handleConcludeClick = useCallback(async () => {
    const outcome = await saveCurrent();
    if (outcome !== "invalid") {
      onOpenChange(false);
    }
  }, [onOpenChange, saveCurrent]);

  const faceLabel = (face: Face) => {
    const label =
      face === "front" ? t("flashcardFrontLabel") : t("flashcardBackLabel");
    return editing === face
      ? `${label} · ${t("quizComposerEditingLabel")}`
      : label;
  };

  const target = targetFace(faces, editing);
  let submitLabel = t("flashcardComposerCompleteLabel");
  let placeholder = t("flashcardComposerCompletePlaceholder");
  if (editing) {
    submitLabel = t("quizComposerUpdateAction");
    placeholder =
      editing === "front"
        ? t("flashcardComposerFrontPlaceholder")
        : t("flashcardComposerBackPlaceholder");
  } else if (target === "front") {
    submitLabel = t("flashcardComposerAddFrontAction");
    placeholder = t("flashcardComposerFrontPlaceholder");
  } else if (target === "back") {
    submitLabel = t("flashcardComposerAddBackAction");
    placeholder = t("flashcardComposerBackPlaceholder");
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl"
        data-shaking={isShaking || undefined}
        onEscapeKeyDown={preventAndShake}
        onInteractOutside={preventAndShake}
        onOpenAutoFocus={handleOpenAutoFocus}
        ref={contentRef}
      >
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>
            {flashcardId ? t("editFlashcardAction") : t("addFlashcardAction")}
          </DialogTitle>
        </DialogHeader>
        <div
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          ref={bodyRef}
        >
          <FlipCard
            back={<FaceText content={faces.back} />}
            backLabel={faceLabel("back")}
            color={resolveProgramColor(color)}
            flipped={showingBack}
            front={<FaceText content={faces.front} />}
            frontLabel={faceLabel("front")}
            highlightedFace={editing}
            // Nothing to flip to on an empty card (docs/specs/clarify-editors.md AC-3).
            hint={
              faces.front || faces.back ? t("flashcardFlipHint") : undefined
            }
            onFlip={handleFlip}
          />
          <div className="flex items-center justify-center gap-2">
            <Button
              disabled={!visibleContent}
              onClick={handleEditClick}
              size="sm"
              type="button"
              variant="outline"
            >
              <Pencil />
              {visibleFace === "front"
                ? t("editFlashcardFrontAction")
                : t("editFlashcardBackAction")}
            </Button>
            <ImageAttachmentViewer
              fileName={visibleContent ? visibleContent.imagePath : null}
            />
          </div>
          <MarkdownComposer
            cancelLabel={t("quizComposerCancelEditAction")}
            disabled={!target}
            imagePath={draft.imagePath}
            label={t("flashcardComposerLabel")}
            onCancel={editing ? handleCancelEdit : undefined}
            onChange={handleDraftTextChange}
            onImagePathChange={handleDraftImagePathChange}
            onSubmit={handleComposerSubmit}
            placeholder={placeholder}
            submitLabel={submitLabel}
            textareaRef={textareaRef}
            value={draft.text}
          />
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {t(error)}
            </p>
          ) : null}
        </div>
        <DialogFooter className="px-4 pb-4">
          {/* What is already saved, so adding never feels like a guess
              (docs/specs/clarify-editors.md AC-1). */}
          {savedCount === undefined ? null : (
            <p
              aria-live="polite"
              className="mr-auto self-center text-muted-foreground text-xs"
            >
              {t("flashcardsSavedCount", { count: savedCount })}
            </p>
          )}
          <Button
            disabled={isSaving}
            onClick={handleAddFlashcardClick}
            type="button"
            // One primary per area (docs/specs/polish.md AC-2): Done.
            variant="ghost"
          >
            {t("saveAndAddAnotherFlashcardAction")}
          </Button>
          <Button
            disabled={isSaving}
            onClick={handleConcludeClick}
            type="button"
          >
            {t("concludeQuizEditingAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
