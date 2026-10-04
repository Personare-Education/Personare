import {
  FileText,
  Layers,
  Link,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { selectPdfFile } from "@/actions/dialog";
import type { Activity } from "@/components/activities-data-table";
import PdfDropzone from "@/components/pdf-dropzone";
import QuizImportPanel from "@/components/quiz-import-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedQuizQuestion } from "@/utils/quiz-markdown";
import { cn } from "@/utils/tailwind";

// A sequence ("group") holds other activities in order
// (docs/specs/sequences-and-locks.md §3 AC-1).
const MVP_ACTIVITY_TYPES = [
  "link",
  "quiz",
  "pdf",
  "flashcard_deck",
  "group",
] as const;

export type ActivityTypeOption = (typeof MVP_ACTIVITY_TYPES)[number];

const ACTIVITY_TYPE_TRANSLATION_KEYS: Record<ActivityTypeOption, string> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  group: "activityTypeGroup",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

const ACTIVITY_TYPE_ICONS: Record<ActivityTypeOption, LucideIcon> = {
  flashcard_deck: Layers,
  group: ListOrdered,
  link: Link,
  pdf: FileText,
  quiz: ListChecks,
};

const CARD_CLASS_NAME =
  "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary/10";

/**
 * Creating a Quiz: Details -> Source -> Import (docs/specs/quiz-ai-import.md).
 * Creating a PDF: Details -> File (docs/specs/pdf-activity-dropzone.md).
 */
type Step = "details" | "file" | "import" | "source";
type QuizSource = "ai" | "manual";
type PrimaryAction = "import" | "next" | "save";

const STEP_NUMBERS: Record<Step, number> = {
  details: 1,
  file: 2,
  import: 3,
  source: 2,
};

const QUIZ_SOURCES: {
  descriptionKey: string;
  icon: LucideIcon;
  titleKey: string;
  value: QuizSource;
}[] = [
  {
    descriptionKey: "quizSourceAiDescription",
    icon: Sparkles,
    titleKey: "quizSourceAiTitle",
    value: "ai",
  },
  {
    descriptionKey: "quizSourceManualDescription",
    icon: PencilLine,
    titleKey: "quizSourceManualTitle",
    value: "manual",
  },
];

function primaryActionFor(
  step: Step,
  hasMoreSteps: boolean,
  quizSource: QuizSource | null
): PrimaryAction {
  if (step === "import") {
    return "import";
  }
  if (step === "details") {
    return hasMoreSteps ? "next" : "save";
  }
  if (step === "file") {
    return "save";
  }
  return quizSource === "manual" ? "save" : "next";
}

/** Where "Next" leads: Details -> File (PDF) or Source (Quiz); Source -> Import. */
function nextStepFrom(step: Step, isPdfCreation: boolean): Step {
  if (step !== "details") {
    return "import";
  }
  return isPdfCreation ? "file" : "source";
}

function isStepIncomplete(
  step: Step,
  quizSource: QuizSource | null,
  importCount: number,
  filePath: string | null
): boolean {
  return (
    (step === "source" && !quizSource) ||
    (step === "import" && importCount === 0) ||
    (step === "file" && !filePath)
  );
}

function stepCountFor(
  isPdfCreation: boolean,
  quizSource: QuizSource | null
): number {
  if (isPdfCreation || quizSource === "manual") {
    return 2;
  }
  return 3;
}

interface ActivityFormDialogProps {
  activity: Activity | null;
  /** The types offered; inside a sequence, only PDF, link and quiz (§3 AC-2). */
  allowedTypes?: readonly ActivityTypeOption[];
  onImportQuiz: (title: string, questions: ParsedQuizQuestion[]) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    title: string,
    type: string,
    url: string | null,
    filePath: string | null
  ) => void;
  open: boolean;
}

export default function ActivityFormDialog({
  activity,
  allowedTypes = MVP_ACTIVITY_TYPES,
  onImportQuiz,
  onOpenChange,
  onSubmit,
  open,
}: ActivityFormDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [type, setType] = useState<string>(activity?.type ?? allowedTypes[0]);
  const [url, setUrl] = useState(activity?.url ?? "");
  const [filePath, setFilePath] = useState(activity?.filePath ?? null);
  const [step, setStep] = useState<Step>("details");
  const [movingBack, setMovingBack] = useState(false);
  const [quizSource, setQuizSource] = useState<QuizSource | null>(null);
  const [importedQuestions, setImportedQuestions] = useState<
    ParsedQuizQuestion[] | null
  >(null);

  useEffect(() => {
    if (open) {
      setTitle(activity?.title ?? "");
      setType(activity?.type ?? allowedTypes[0]);
      setUrl(activity?.url ?? "");
      setFilePath(activity?.filePath ?? null);
      setStep("details");
      setQuizSource(null);
      setImportedQuestions(null);
    }
  }, [open, activity, allowedTypes]);

  const isQuizCreation = !activity && type === "quiz";
  const isPdfCreation = !activity && type === "pdf";
  const importCount = importedQuestions?.length ?? 0;
  const primaryAction = primaryActionFor(
    step,
    isQuizCreation || isPdfCreation,
    quizSource
  );

  const goTo = useCallback((next: Step, back = false) => {
    setMovingBack(back);
    setStep(next);
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (primaryAction === "next") {
        goTo(nextStepFrom(step, isPdfCreation));
      } else if (primaryAction === "import") {
        if (importedQuestions && importedQuestions.length > 0) {
          onImportQuiz(title, importedQuestions);
        }
      } else {
        onSubmit(
          title,
          type,
          type === "link" ? url : null,
          type === "pdf" ? filePath : null
        );
      }
    },
    [
      filePath,
      goTo,
      importedQuestions,
      isPdfCreation,
      onImportQuiz,
      onSubmit,
      primaryAction,
      step,
      title,
      type,
      url,
    ]
  );

  const handleBackClick = useCallback(() => {
    goTo(step === "import" ? "source" : "details", true);
  }, [goTo, step]);

  const handleFilePathChange = useCallback((nextFilePath: string) => {
    setFilePath(nextFilePath);
  }, []);

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const primaryActionLabels: Record<PrimaryAction, string> = {
    import: t("quizImportCreateAction", { count: importCount }),
    next: t("nextStepAction"),
    save: t("saveAction"),
  };
  const isPrimaryDisabled = isStepIncomplete(
    step,
    quizSource,
    importCount,
    filePath
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {/* Capped to the window: the step body scrolls, header and footer stay put. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {activity ? t("editActivityTitle") : t("createActivityTitle")}
            </DialogTitle>
            {isQuizCreation || isPdfCreation ? (
              <StepIndicator
                current={STEP_NUMBERS[step]}
                total={stepCountFor(isPdfCreation, quizSource)}
              />
            ) : null}
          </DialogHeader>
          <div
            className={cn(
              "fade-in-0 -mx-1 flex min-h-0 animate-in flex-col gap-4 overflow-y-auto px-1 py-4 duration-200 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]",
              movingBack ? "slide-in-from-left-4" : "slide-in-from-right-4"
            )}
            key={step}
          >
            {step === "details" ? (
              <ActivityDetailsFields
                allowedTypes={allowedTypes}
                filePath={filePath}
                isCreating={!activity}
                onFilePathChange={setFilePath}
                onTitleChange={setTitle}
                onTypeChange={setType}
                onUrlChange={setUrl}
                title={title}
                type={type}
                url={url}
              />
            ) : null}
            {step === "source" ? (
              <QuizSourceStep
                onValueChange={setQuizSource}
                value={quizSource}
              />
            ) : null}
            {step === "import" ? (
              <QuizImportPanel onParsedChange={setImportedQuestions} />
            ) : null}
            {step === "file" ? (
              <PdfDropzone
                filePath={filePath}
                onFilePathChange={handleFilePathChange}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={step === "details" ? handleCancelClick : handleBackClick}
              type="button"
              variant="outline"
            >
              {step === "details" ? t("cancelAction") : t("previousStepAction")}
            </Button>
            <Button disabled={isPrimaryDisabled} type="submit">
              {primaryActionLabels[primaryAction]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ActivityDetailsFieldsProps {
  allowedTypes: readonly ActivityTypeOption[];
  filePath: string | null;
  /** Creating a PDF picks its file in the next step, not here. */
  isCreating: boolean;
  onFilePathChange: (filePath: string) => void;
  onTitleChange: (title: string) => void;
  onTypeChange: (type: string) => void;
  onUrlChange: (url: string) => void;
  title: string;
  type: string;
  url: string;
}

function ActivityDetailsFields({
  allowedTypes,
  filePath,
  isCreating,
  onFilePathChange,
  onTitleChange,
  onTypeChange,
  onUrlChange,
  title,
  type,
  url,
}: ActivityDetailsFieldsProps) {
  const { t } = useTranslation();
  const titleInputId = useId();
  const typeLabelId = useId();
  const urlInputId = useId();

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onTitleChange(event.target.value);
    },
    [onTitleChange]
  );

  const handleUrlChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onUrlChange(event.target.value);
    },
    [onUrlChange]
  );

  const handleSelectPdfFileClick = useCallback(() => {
    selectPdfFile().then((selectedPath) => {
      if (selectedPath) {
        onFilePathChange(selectedPath);
      }
    });
  }, [onFilePathChange]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor={titleInputId}>{t("activityTitleLabel")}</Label>
        <Input
          id={titleInputId}
          onChange={handleTitleChange}
          required
          value={title}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label id={typeLabelId}>{t("activityTypeLabel")}</Label>
        <RadioGroupPrimitive.Root
          aria-labelledby={typeLabelId}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          onValueChange={onTypeChange}
          value={type}
        >
          {allowedTypes.map((activityType) => {
            const Icon = ACTIVITY_TYPE_ICONS[activityType];
            return (
              <RadioGroupPrimitive.Item
                className={CARD_CLASS_NAME}
                key={activityType}
                value={activityType}
              >
                <Icon aria-hidden="true" className="size-6" />
                <span>{t(ACTIVITY_TYPE_TRANSLATION_KEYS[activityType])}</span>
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
      </div>
      {type === "link" && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={urlInputId}>{t("activityUrlLabel")}</Label>
          <Input
            id={urlInputId}
            onChange={handleUrlChange}
            type="url"
            value={url}
          />
        </div>
      )}
      {type === "pdf" && !isCreating && (
        <div className="flex flex-col gap-1">
          <Button
            onClick={handleSelectPdfFileClick}
            type="button"
            variant="outline"
          >
            {t("selectPdfFileAction")}
          </Button>
          {filePath ? <span>{filePath}</span> : null}
        </div>
      )}
    </>
  );
}

function QuizSourceStep({
  onValueChange,
  value,
}: {
  onValueChange: (value: QuizSource) => void;
  value: QuizSource | null;
}) {
  const { t } = useTranslation();
  const labelId = useId();

  const handleValueChange = useCallback(
    (next: string) => {
      onValueChange(next as QuizSource);
    },
    [onValueChange]
  );

  return (
    <div className="flex flex-col gap-1">
      <Label id={labelId}>{t("quizSourceLabel")}</Label>
      <RadioGroupPrimitive.Root
        aria-labelledby={labelId}
        className="grid grid-cols-2 gap-2"
        onValueChange={handleValueChange}
        value={value ?? ""}
      >
        {QUIZ_SOURCES.map((source) => (
          <RadioGroupPrimitive.Item
            className={cn(CARD_CLASS_NAME, "text-center")}
            key={source.value}
            value={source.value}
          >
            <source.icon aria-hidden="true" className="size-6" />
            <span className="font-medium">{t(source.titleKey)}</span>
            <span className="text-muted-foreground text-xs">
              {t(source.descriptionKey)}
            </span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span
            className={cn(
              "h-1 w-6 rounded-full bg-muted transition-colors",
              index < current && "bg-primary"
            )}
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, positional bars.
            key={index}
          />
        ))}
      </div>
      <span className="text-muted-foreground text-xs">
        {t("quizCreationStepIndicator", { current, total })}
      </span>
    </div>
  );
}
