import { SiMarkdown } from "@icons-pack/react-simple-icons";
import {
  Bold,
  Code,
  Heading,
  ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  type LucideIcon,
  Paperclip,
  TextQuote,
  X,
} from "lucide-react";
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
  useCallback,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import {
  saveAttachmentImage,
  saveAttachmentImageData,
} from "@/actions/attachments";
import { selectImageFile } from "@/actions/dialog";
import ImageAttachmentViewer from "@/components/image-attachment-viewer";
import MarkdownContent from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  applyMarkdownFormat,
  type MarkdownFormat,
} from "@/utils/markdown-format";

const TOOLBAR: {
  format: MarkdownFormat;
  icon: LucideIcon;
  labelKey: string;
}[][] = [
  [
    { format: "heading", icon: Heading, labelKey: "markdownHeadingAction" },
    { format: "bold", icon: Bold, labelKey: "markdownBoldAction" },
    { format: "italic", icon: Italic, labelKey: "markdownItalicAction" },
    { format: "quote", icon: TextQuote, labelKey: "markdownQuoteAction" },
    { format: "code", icon: Code, labelKey: "markdownCodeAction" },
    { format: "link", icon: Link, labelKey: "markdownLinkAction" },
  ],
  [
    {
      format: "orderedList",
      icon: ListOrdered,
      labelKey: "markdownOrderedListAction",
    },
    {
      format: "unorderedList",
      icon: List,
      labelKey: "markdownUnorderedListAction",
    },
  ],
];

const IMAGE_EXTENSIONS = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x80_00;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Stores an image File into the attachments folder: by its path when it has
 * one (a file dragged from the disk), otherwise by its bytes (a screenshot
 * pasted from the clipboard).
 */
function saveImageFile(file: File): Promise<{ fileName: string }> | null {
  const extension =
    IMAGE_EXTENSIONS[file.type as keyof typeof IMAGE_EXTENSIONS];
  if (!extension) {
    return null;
  }

  const sourcePath = window.personare?.getPathForFile(file);
  if (sourcePath) {
    return saveAttachmentImage(sourcePath);
  }

  return file
    .arrayBuffer()
    .then((buffer) => saveAttachmentImageData(toBase64(buffer), extension));
}

function firstImage(files: ArrayLike<File> | undefined): File | null {
  return (
    Array.from(files ?? []).find((file) => file.type.startsWith("image/")) ??
    null
  );
}

interface ToolbarButtonProps {
  disabled?: boolean;
  format: MarkdownFormat;
  icon: LucideIcon;
  label: string;
  onApply: (format: MarkdownFormat) => void;
}

function ToolbarButton({
  disabled,
  format,
  icon: Icon,
  label,
  onApply,
}: ToolbarButtonProps) {
  const handleClick = useCallback(() => {
    onApply(format);
  }, [format, onApply]);

  return (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={handleClick}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
    >
      <Icon />
    </Button>
  );
}

interface MarkdownComposerProps {
  /** Shown next to the submit button while an item is being edited. */
  cancelLabel?: string;
  /** Nothing to write right now (e.g. a flashcard with both faces filled). */
  disabled?: boolean;
  imagePath: string | null;
  /** Accessible name of the textarea. */
  label: string;
  onCancel?: () => void;
  onChange: (value: string) => void;
  onImagePathChange: (imagePath: string | null) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitLabel: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
  value: string;
}

/**
 * A GitHub-style Markdown editor (docs/specs/quiz-question-single-editor.md
 * AC-2): Write/Preview tabs, a formatting toolbar, and a pending image that
 * can be picked, dropped or pasted. Enter breaks the line, Shift+Enter
 * submits.
 */
export default function MarkdownComposer({
  cancelLabel,
  disabled = false,
  imagePath,
  label,
  onCancel,
  onChange,
  onImagePathChange,
  onSubmit,
  placeholder,
  submitLabel,
  textareaRef,
  value,
}: MarkdownComposerProps) {
  const { t } = useTranslation();
  const ownRef = useRef<HTMLTextAreaElement | null>(null);

  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      ownRef.current = node;
      if (typeof textareaRef === "function") {
        textareaRef(node);
      } else if (textareaRef) {
        textareaRef.current = node;
      }
    },
    [textareaRef]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter" &&
        event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        if (!disabled) {
          onSubmit();
        }
      }
    },
    [disabled, onSubmit]
  );

  const applyFormat = useCallback(
    (format: MarkdownFormat) => {
      const textarea = ownRef.current;
      const start = textarea?.selectionStart ?? value.length;
      const end = textarea?.selectionEnd ?? value.length;
      const next = applyMarkdownFormat({ end, start, value }, format);

      onChange(next.value);
      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(next.start, next.end);
      });
    },
    [onChange, value]
  );

  const attach = useCallback(
    (saving: Promise<{ fileName: string } | null> | null) => {
      saving?.then((saved) => {
        if (saved) {
          onImagePathChange(saved.fileName);
        }
      });
    },
    [onImagePathChange]
  );

  const handleAttachClick = useCallback(() => {
    attach(
      selectImageFile().then((sourcePath) =>
        sourcePath ? saveAttachmentImage(sourcePath) : null
      )
    );
  }, [attach]);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const file = firstImage(event.clipboardData?.files);
      if (file) {
        event.preventDefault();
        attach(saveImageFile(file));
      }
    },
    [attach]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLTextAreaElement>) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
    },
    []
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLTextAreaElement>) => {
      const file = firstImage(event.dataTransfer?.files);
      if (file) {
        event.preventDefault();
        attach(saveImageFile(file));
      }
    },
    [attach]
  );

  const handleRemoveImageClick = useCallback(() => {
    // Only detaches it: the file may still belong to the item being edited.
    onImagePathChange(null);
  }, [onImagePathChange]);

  return (
    <Tabs
      className="gap-0 rounded-lg border border-input bg-card"
      defaultValue="write"
    >
      <div className="flex flex-wrap items-center justify-between gap-1 border-input border-b px-2 pt-1">
        <TabsList className="h-8" variant="line">
          <TabsTrigger value="write">{t("markdownWriteTabLabel")}</TabsTrigger>
          <TabsTrigger value="preview">
            {t("markdownPreviewTabLabel")}
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-0.5 pb-1">
          {TOOLBAR.map((group, groupIndex) => (
            <div
              className="flex items-center gap-0.5 border-input not-first:border-l not-first:pl-1"
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of button groups.
              key={groupIndex}
            >
              {group.map(({ format, icon, labelKey }) => (
                <ToolbarButton
                  disabled={disabled}
                  format={format}
                  icon={icon}
                  key={format}
                  label={t(labelKey)}
                  onApply={applyFormat}
                />
              ))}
            </div>
          ))}
          <div className="flex items-center border-input border-l pl-1">
            <Button
              aria-label={t("attachImageAction")}
              disabled={disabled}
              onClick={handleAttachClick}
              size="icon-sm"
              title={t("attachImageAction")}
              type="button"
              variant="ghost"
            >
              <Paperclip />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-2">
        <TabsContent value="write">
          <Textarea
            aria-label={label}
            className="max-h-48 min-h-20"
            disabled={disabled}
            onChange={handleChange}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            ref={setTextareaRef}
            value={value}
          />
        </TabsContent>
        <TabsContent value="preview">
          <MarkdownContent
            className="max-h-48 min-h-20 overflow-y-auto rounded-md border border-input px-2 py-2"
            content={value}
          />
        </TabsContent>
        {imagePath ? (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <ImageIcon className="size-3.5 text-muted-foreground" />
            <span>{t("imageAttachedLabel")}</span>
            <ImageAttachmentViewer fileName={imagePath} />
            <Button
              aria-label={t("removeImageAction")}
              onClick={handleRemoveImageClick}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span className="flex items-center gap-1.5">
            <SiMarkdown className="size-4" />
            {t("markdownSupportedHint")}
          </span>
          <span aria-hidden="true" className="h-4 border-input border-l" />
          <button
            className="flex items-center gap-1.5 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            onClick={handleAttachClick}
            type="button"
          >
            <ImageIcon className="size-3.5" />
            {t("markdownAttachHint")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && cancelLabel ? (
            <Button onClick={onCancel} type="button" variant="outline">
              {cancelLabel}
            </Button>
          ) : null}
          <Button disabled={disabled} onClick={onSubmit} type="button">
            {submitLabel}
          </Button>
        </div>
      </div>
    </Tabs>
  );
}
