import { CircleAlert, FileUp, Sparkles } from "lucide-react";
import { type ChangeEvent, useCallback, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { openExternalLink } from "@/actions/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type FileWithPreview,
  useFileUpload,
} from "@/hooks/reui/use-file-upload";
import {
  AI_PROVIDERS,
  type AiProvider,
  promptLanguage,
} from "@/utils/ai-providers";
import {
  buildQuizPrompt,
  type ParsedQuiz,
  type ParsedQuizQuestion,
  parseQuizMarkdown,
  type QuizMarkdownErrorReason,
} from "@/utils/quiz-markdown";
import { cn } from "@/utils/tailwind";

const ERROR_TRANSLATION_KEYS: Record<QuizMarkdownErrorReason, string> = {
  missingText: "quizImportErrorMissingText",
  multipleCorrectOptions: "quizImportErrorMultipleCorrectOptions",
  noCorrectOption: "quizImportErrorNoCorrectOption",
  tooFewOptions: "quizImportErrorTooFewOptions",
};

interface QuizImportPanelProps {
  /** Valid questions from the last file, or null while there is none. */
  onParsedChange: (questions: ParsedQuizQuestion[] | null) => void;
}

/**
 * The "import from an AI" step of quiz creation (docs/specs/quiz-ai-import.md):
 * pick a theme and an AI, send it the prompt, then drop the .md it returns.
 */
export default function QuizImportPanel({
  onParsedChange,
}: QuizImportPanelProps) {
  const { i18n, t } = useTranslation();
  const themeInputId = useId();
  const aiSelectId = useId();
  const [theme, setTheme] = useState("");
  const [provider, setProvider] = useState<AiProvider>("chatgpt");
  const [copiedFor, setCopiedFor] = useState<AiProvider | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedQuiz | null>(null);

  const readFile = useCallback(
    async ([added]: FileWithPreview[]) => {
      if (!(added?.file instanceof File)) {
        return;
      }
      const result = parseQuizMarkdown(await added.file.text());
      setFileName(added.file.name);
      setParsed(result);
      onParsedChange(result.questions);
    },
    [onParsedChange]
  );

  const [
    { errors: fileErrors, isDragging },
    {
      getInputProps,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
    },
  ] = useFileUpload({
    accept: ".md,text/markdown",
    onFilesAdded: readFile,
  });

  const handleThemeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setTheme(event.target.value);
      setCopiedFor(null);
    },
    []
  );

  const handleProviderChange = useCallback((value: string) => {
    setProvider(value as AiProvider);
    setCopiedFor(null);
  }, []);

  const handleSendPrompt = useCallback(async () => {
    const config = AI_PROVIDERS[provider];
    const prompt = buildQuizPrompt(theme, promptLanguage(i18n.language));

    await navigator.clipboard.writeText(prompt);
    openExternalLink(config.url(prompt));
    setCopiedFor(provider);
  }, [i18n.language, provider, theme]);

  const providerLabel = AI_PROVIDERS[provider].label;
  let copiedMessage: string | null = null;
  if (copiedFor) {
    copiedMessage = t(
      AI_PROVIDERS[copiedFor].prefill
        ? "quizImportPromptCopied"
        : "quizImportPromptCopiedPaste",
      { ai: AI_PROVIDERS[copiedFor].label }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={themeInputId}>{t("quizImportThemeLabel")}</Label>
          <Input
            id={themeInputId}
            onChange={handleThemeChange}
            placeholder={t("quizImportThemePlaceholder")}
            value={theme}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={aiSelectId}>{t("quizImportAiLabel")}</Label>
          <Select onValueChange={handleProviderChange} value={provider}>
            <SelectTrigger className="w-32" id={aiSelectId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AI_PROVIDERS).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        disabled={!theme.trim()}
        onClick={handleSendPrompt}
        type="button"
        variant="outline"
      >
        <Sparkles />
        {t("quizImportSendPromptAction", { ai: providerLabel })}
      </Button>
      {copiedMessage ? (
        <p className="text-muted-foreground text-sm">{copiedMessage}</p>
      ) : null}

      {/* The whole drop area is a button: click or Enter opens the file picker. */}
      <button
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring",
          isDragging && "border-primary bg-primary/10"
        )}
        data-dragging={isDragging || undefined}
        onClick={openFileDialog}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        type="button"
      >
        <FileUp aria-hidden="true" className="size-6 text-muted-foreground" />
        <span className="font-medium">{t("quizImportDropzoneLabel")}</span>
        <span className="text-muted-foreground text-xs">
          {fileName ?? t("quizImportDropzoneHint")}
        </span>
      </button>
      <input
        {...getInputProps()}
        aria-label={t("quizImportDropzoneLabel")}
        className="sr-only"
        tabIndex={-1}
      />
      {fileErrors.length > 0 ? (
        <p className="text-destructive text-sm">
          {t("quizImportInvalidFileMessage")}
        </p>
      ) : null}

      {parsed ? <QuizImportPreview parsed={parsed} /> : null}
    </div>
  );
}

function QuizImportPreview({ parsed }: { parsed: ParsedQuiz }) {
  const { t } = useTranslation();

  if (parsed.questions.length === 0 && parsed.errors.length === 0) {
    return (
      <p className="text-destructive text-sm">
        {t("quizImportEmptyFileMessage")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-medium">
        {t("quizImportPreviewCount", { count: parsed.questions.length })}
      </p>
      {/* No nowrap: a long question would widen the whole dialog. The list
          scrolls on its own, or a long quiz stretches the dialog to the
          window's height. */}
      <ol className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1 text-muted-foreground [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
        {parsed.questions.map((question, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt from scratch for every file and never reordered.
          <li className="flex gap-1" key={index}>
            <span className="shrink-0">{index + 1}.</span>
            <span className="line-clamp-2 min-w-0 break-words">
              {question.text}
            </span>
          </li>
        ))}
      </ol>
      {parsed.errors.length > 0 ? (
        <div className="flex flex-col gap-1 text-destructive">
          {parsed.errors.map((error) => (
            <p className="flex items-center gap-1" key={error.question}>
              <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
              {t(ERROR_TRANSLATION_KEYS[error.reason], {
                question: error.question,
              })}
            </p>
          ))}
          <p className="text-muted-foreground">{t("quizImportSkippedNote")}</p>
        </div>
      ) : null}
    </div>
  );
}
