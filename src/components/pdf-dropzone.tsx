import { FileUp } from "lucide-react";
import { type DragEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { selectPdfFile } from "@/actions/dialog";
import { cn } from "@/utils/tailwind";

interface PdfDropzoneProps {
  filePath: string | null;
  onFilePathChange: (filePath: string) => void;
}

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

const PATH_SEPARATOR = /[\\/]/;

function fileNameOf(filePath: string): string {
  return filePath.split(PATH_SEPARATOR).at(-1) ?? filePath;
}

/**
 * Where a PDF activity's file is picked (docs/specs/pdf-activity-dropzone.md):
 * drop a PDF on it, or click it for the native file dialog. Looks like the
 * quiz import's drop-zone (quiz-import-panel.tsx). The activity keeps the
 * file's path; a dropped file's path comes from the preload's
 * `window.personare.getPathForFile`.
 */
export default function PdfDropzone({
  filePath,
  onFilePathChange,
}: PdfDropzoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);

  const handleClick = useCallback(() => {
    selectPdfFile().then((selectedPath) => {
      if (selectedPath) {
        setIsInvalid(false);
        onFilePathChange(selectedPath);
      }
    });
  }, [onFilePathChange]);

  const handleDragOver = useCallback((event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const [file] = Array.from(event.dataTransfer.files);
      if (!file) {
        return;
      }
      const droppedPath = isPdf(file)
        ? window.personare?.getPathForFile(file)
        : undefined;
      if (!droppedPath) {
        setIsInvalid(true);
        return;
      }
      setIsInvalid(false);
      onFilePathChange(droppedPath);
    },
    [onFilePathChange]
  );

  return (
    <div className="flex flex-col gap-2">
      {/* The whole drop area is a button: click or Enter opens the file picker. */}
      <button
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
          isDragging && "border-primary bg-primary/10"
        )}
        data-dragging={isDragging || undefined}
        onClick={handleClick}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        type="button"
      >
        <FileUp aria-hidden="true" className="size-6 text-muted-foreground" />
        <span className="font-medium">{t("pdfDropzoneLabel")}</span>
        <span className="break-all text-muted-foreground text-xs">
          {filePath ? fileNameOf(filePath) : t("pdfDropzoneHint")}
        </span>
      </button>
      {isInvalid ? (
        <p className="text-destructive text-sm">
          {t("pdfDropzoneInvalidFileMessage")}
        </p>
      ) : null}
    </div>
  );
}
