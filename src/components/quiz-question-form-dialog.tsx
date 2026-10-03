import {
  CheckCircle2,
  Circle,
  GripVerticalIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownComposer from "@/components/markdown-composer";
import MarkdownContent from "@/components/markdown-content";
import {
  Sortable,
  SortableItem,
  SortableItemHandle,
} from "@/components/reui/sortable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDialogShake } from "@/hooks/use-dialog-shake";
import { cn } from "@/utils/tailwind";

export interface QuizQuestionFormValue {
  id: string;
  imagePath: string | null;
  options: {
    id: string;
    imagePath: string | null;
    isCorrect: boolean;
    text: string;
  }[];
  text: string;
}

export interface QuizQuestionSubmitOption {
  imagePath: string | null;
  isCorrect: boolean;
  text: string;
}

interface Draft {
  imagePath: string | null;
  text: string;
}

interface StackItem extends Draft {
  key: string;
}

interface OptionItem extends StackItem {
  isCorrect: boolean;
}

interface QuestionForm {
  heading: StackItem | null;
  options: OptionItem[];
}

type EditTarget = { kind: "heading" } | { key: string; kind: "option" };

const MIN_OPTIONS = 2;
const EMPTY_DRAFT: Draft = { imagePath: null, text: "" };
const EMPTY_FORM: QuestionForm = { heading: null, options: [] };
const FADE_MS = 150;

function formFromQuestion(
  question: QuizQuestionFormValue | null
): QuestionForm {
  if (!question) {
    return EMPTY_FORM;
  }
  return {
    heading: {
      imagePath: question.imagePath,
      key: question.id,
      text: question.text,
    },
    options: question.options.map((option) => ({
      imagePath: option.imagePath,
      isCorrect: option.isCorrect,
      key: option.id,
      text: option.text,
    })),
  };
}

function isDraftEmpty(draft: Draft) {
  return draft.text.trim() === "" && !draft.imagePath;
}

/**
 * docs/specs/quiz-question-single-editor.md AC-3/AC-5: the first
 * submission is the heading, the next ones alternatives; while editing, the
 * submission replaces the edited item in place.
 */
function commitDraft(
  form: QuestionForm,
  draft: Draft,
  editing: EditTarget | null,
  newKey: () => string
): QuestionForm {
  if (isDraftEmpty(draft)) {
    return form;
  }
  if (editing?.kind === "heading" || !(editing || form.heading)) {
    return {
      ...form,
      heading: { ...draft, key: form.heading?.key ?? newKey() },
    };
  }
  if (editing?.kind === "option") {
    return {
      ...form,
      options: form.options.map((option) =>
        option.key === editing.key ? { ...option, ...draft } : option
      ),
    };
  }
  return {
    ...form,
    options: [...form.options, { ...draft, isCorrect: false, key: newKey() }],
  };
}

function validationError(form: QuestionForm): string | null {
  if (!form.heading) {
    return "quizFormMissingHeadingError";
  }
  if (form.options.length < MIN_OPTIONS) {
    return "quizFormTooFewOptionsError";
  }
  if (form.options.filter((option) => option.isCorrect).length !== 1) {
    return "quizFormNoCorrectOptionError";
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

interface OptionRowProps {
  onEdit: (key: string) => void;
  onMarkCorrect: (key: string) => void;
  onRemove: (key: string) => void;
  option: OptionItem;
}

/**
 * What is inside one alternative's SortableItem: the drag handle (ReUI's
 * grip icon in a dotted area), the rendered text and its actions. It has to
 * live inside the SortableItem, not wrap it: the Sortable finds its direct
 * SortableItem children to build the floating copy dragged under the cursor.
 */
function OptionRowContent({
  onEdit,
  onMarkCorrect,
  onRemove,
  option,
}: OptionRowProps) {
  const { t } = useTranslation();

  const handleMarkCorrectClick = useCallback(() => {
    onMarkCorrect(option.key);
  }, [onMarkCorrect, option.key]);

  const handleEditClick = useCallback(() => {
    onEdit(option.key);
  }, [onEdit, option.key]);

  const handleRemoveClick = useCallback(() => {
    onRemove(option.key);
  }, [onRemove, option.key]);

  return (
    <>
      <SortableItemHandle asChild>
        <button
          aria-label={t("dragQuizOptionAction")}
          className="flex w-6 shrink-0 items-center justify-center self-stretch rounded-md border border-muted-foreground/40 border-dashed text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          title={t("dragQuizOptionAction")}
          type="button"
        >
          <GripVerticalIcon className="h-4 w-4" />
        </button>
      </SortableItemHandle>
      <MarkdownContent className="flex-1 self-center" content={option.text} />
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-label={t("markCorrectQuizOptionAction")}
          aria-pressed={option.isCorrect}
          className={cn(option.isCorrect && "text-success-text")}
          onClick={handleMarkCorrectClick}
          size="sm"
          type="button"
          variant={option.isCorrect ? "secondary" : "outline"}
        >
          {option.isCorrect ? <CheckCircle2 /> : <Circle />}
          {option.isCorrect
            ? t("quizReviewCorrectStatusLabel")
            : t("markCorrectQuizOptionAction")}
        </Button>
        <ImageAttachmentViewer fileName={option.imagePath} />
        <Button
          aria-label={t("editQuizOptionAction")}
          onClick={handleEditClick}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Pencil />
        </Button>
        <Button
          aria-label={t("removeQuizOptionAction")}
          onClick={handleRemoveClick}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
    </>
  );
}

function getOptionKey(option: OptionItem) {
  return option.key;
}

interface QuizQuestionFormDialogProps {
  onOpenChange: (open: boolean) => void;
  /**
   * Saves one question: `questionId` is the question being edited, or null
   * for a new one. The dialog waits for it before moving on or closing.
   */
  onSubmit: (
    questionId: string | null,
    text: string,
    imagePath: string | null,
    options: QuizQuestionSubmitOption[]
  ) => Promise<void> | void;
  open: boolean;
  question: QuizQuestionFormValue | null;
  /** How many questions the quiz already has saved, for the footer. */
  savedCount?: number;
}

/**
 * Writes quiz questions with a single Markdown editor
 * (docs/specs/quiz-question-single-editor.md): its submissions stack up as
 * the heading and then the alternatives. It only closes through "Done" or
 * its X -- clicking outside or pressing Escape shakes it instead.
 */
export default function QuizQuestionFormDialog({
  onOpenChange,
  onSubmit,
  open,
  question,
  savedCount,
}: QuizQuestionFormDialogProps) {
  const { t } = useTranslation();
  const { contentRef, isShaking, preventAndShake } =
    useDialogShake<HTMLDivElement>();
  const bodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextKey = useRef(0);
  const [form, setForm] = useState<QuestionForm>(() =>
    formFromQuestion(question)
  );
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [stash, setStash] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(
    question?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const newKey = useCallback(() => {
    nextKey.current += 1;
    return `new-${nextKey.current}`;
  }, []);

  const reset = useCallback((next: QuizQuestionFormValue | null) => {
    setForm(formFromQuestion(next));
    setDraft(EMPTY_DRAFT);
    setStash(EMPTY_DRAFT);
    setEditing(null);
    setQuestionId(next ? next.id : null);
    setError(null);
  }, []);

  useEffect(() => {
    if (open) {
      reset(question);
    }
  }, [open, question, reset]);

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
    if (isDraftEmpty(draft)) {
      return;
    }
    setForm((prev) => commitDraft(prev, draft, editing, newKey));
    setDraft(editing ? stash : EMPTY_DRAFT);
    setStash(EMPTY_DRAFT);
    setEditing(null);
    setError(null);
  }, [draft, editing, newKey, stash]);

  const startEditing = useCallback(
    (target: EditTarget, item: Draft) => {
      if (!editing) {
        setStash(draft);
      }
      setEditing(target);
      setDraft({ imagePath: item.imagePath, text: item.text });
      focusEditor();
    },
    [draft, editing, focusEditor]
  );

  const handleEditHeadingClick = useCallback(() => {
    if (form.heading) {
      startEditing({ kind: "heading" }, form.heading);
    }
  }, [form.heading, startEditing]);

  const handleEditOption = useCallback(
    (key: string) => {
      const option = form.options.find((item) => item.key === key);
      if (option) {
        startEditing({ key, kind: "option" }, option);
      }
    },
    [form.options, startEditing]
  );

  const handleCancelEdit = useCallback(() => {
    setDraft(stash);
    setStash(EMPTY_DRAFT);
    setEditing(null);
  }, [stash]);

  const handleMarkCorrect = useCallback((key: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option) => ({
        ...option,
        isCorrect: option.key === key,
      })),
    }));
    setError(null);
  }, []);

  const handleRemoveOption = useCallback(
    (key: string) => {
      setForm((prev) => ({
        ...prev,
        options: prev.options.filter((option) => option.key !== key),
      }));
      if (editing?.kind === "option" && editing.key === key) {
        handleCancelEdit();
      }
    },
    [editing, handleCancelEdit]
  );

  // Fired by the Sortable once, on drop, with the alternatives reordered.
  const handleOptionsReorder = useCallback((options: OptionItem[]) => {
    setForm((prev) => ({ ...prev, options }));
  }, []);

  /**
   * AC-6/AC-7: what is still in the editor (and an unsent draft stashed by
   * an edit) joins the question first; then it is validated and saved.
   * Returns whether there was a question and it was saved.
   */
  const saveCurrent = useCallback(async (): Promise<
    "empty" | "invalid" | "saved"
  > => {
    let committed = commitDraft(form, draft, editing, newKey);
    committed = commitDraft(committed, stash, null, newKey);
    setForm(committed);
    setDraft(EMPTY_DRAFT);
    setStash(EMPTY_DRAFT);
    setEditing(null);

    if (!committed.heading && committed.options.length === 0) {
      return "empty";
    }
    const problem = validationError(committed);
    if (problem || !committed.heading) {
      setError(problem);
      return "invalid";
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSubmit(
        questionId,
        committed.heading.text,
        committed.heading.imagePath,
        committed.options.map(({ imagePath, isCorrect, text }) => ({
          imagePath,
          isCorrect,
          text,
        }))
      );
      return "saved";
    } finally {
      setIsSaving(false);
    }
  }, [draft, editing, form, newKey, onSubmit, questionId, stash]);

  const handleAddQuestionClick = useCallback(async () => {
    const outcome = await saveCurrent();
    if (outcome === "empty") {
      setError("quizFormMissingHeadingError");
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

  const editingHeading = editing?.kind === "heading";
  const editingOptionKey = editing?.kind === "option" ? editing.key : null;
  let submitLabel = t("addQuizOptionAction");
  if (editing) {
    submitLabel = t("quizComposerUpdateAction");
  } else if (!form.heading) {
    submitLabel = t("quizComposerAddHeadingAction");
  }
  const placeholder =
    editingHeading || !(editing || form.heading)
      ? t("quizComposerHeadingPlaceholder")
      : t("quizComposerOptionPlaceholder");

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
            {questionId
              ? t("editQuizQuestionAction")
              : t("addQuizQuestionAction")}
          </DialogTitle>
        </DialogHeader>
        <div
          className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4"
          ref={bodyRef}
        >
          {form.heading || form.options.length > 0 ? (
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {form.heading ? (
                <section
                  aria-label={t("quizHeadingLabel")}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border bg-muted/40 p-3",
                    editingHeading && "ring-2 ring-ring/40"
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-muted-foreground text-xs">
                      {t("quizHeadingLabel")}
                      {editingHeading
                        ? ` · ${t("quizComposerEditingLabel")}`
                        : ""}
                    </span>
                    <MarkdownContent
                      className="font-medium"
                      content={form.heading.text}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <ImageAttachmentViewer fileName={form.heading.imagePath} />
                    <Button
                      aria-label={t("editQuizHeadingAction")}
                      onClick={handleEditHeadingClick}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Pencil />
                    </Button>
                  </div>
                </section>
              ) : null}
              <Sortable
                aria-label={t("quizOptionsLabel")}
                className="flex flex-col gap-2"
                getItemValue={getOptionKey}
                onValueChange={handleOptionsReorder}
                role="list"
                strategy="vertical"
                value={form.options}
              >
                {form.options.map((option) => (
                  <SortableItem
                    className={cn(
                      "flex items-start gap-2 rounded-lg border bg-card p-2",
                      option.isCorrect && "border-success/50 bg-success/5",
                      editingOptionKey === option.key && "ring-2 ring-ring/40"
                    )}
                    key={option.key}
                    // The handle is the item's one tab stop.
                    role="listitem"
                    tabIndex={-1}
                    value={option.key}
                  >
                    <OptionRowContent
                      onEdit={handleEditOption}
                      onMarkCorrect={handleMarkCorrect}
                      onRemove={handleRemoveOption}
                      option={option}
                    />
                  </SortableItem>
                ))}
              </Sortable>
            </div>
          ) : null}
          <div className="shrink-0">
            <MarkdownComposer
              cancelLabel={t("quizComposerCancelEditAction")}
              imagePath={draft.imagePath}
              label={t("quizComposerLabel")}
              onCancel={editing ? handleCancelEdit : undefined}
              onChange={handleDraftTextChange}
              onImagePathChange={handleDraftImagePathChange}
              onSubmit={handleComposerSubmit}
              placeholder={placeholder}
              submitLabel={submitLabel}
              textareaRef={textareaRef}
              value={draft.text}
            />
          </div>
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
              {t("quizQuestionsSavedCount", { count: savedCount })}
            </p>
          )}
          <Button
            disabled={isSaving}
            onClick={handleAddQuestionClick}
            type="button"
            // One primary per area (docs/specs/polish.md AC-2): Done.
            variant="ghost"
          >
            {t("saveAndAddAnotherQuestionAction")}
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
