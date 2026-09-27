import {
  FileText,
  Layers,
  Link,
  ListChecks,
  type LucideIcon,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { selectPdfFile } from "@/actions/dialog";
import type { Activity } from "@/components/activities-data-table";
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

const MVP_ACTIVITY_TYPES = ["link", "quiz", "pdf", "flashcard_deck"] as const;

const ACTIVITY_TYPE_TRANSLATION_KEYS: Record<
  (typeof MVP_ACTIVITY_TYPES)[number],
  string
> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

const ACTIVITY_TYPE_ICONS: Record<
  (typeof MVP_ACTIVITY_TYPES)[number],
  LucideIcon
> = {
  flashcard_deck: Layers,
  link: Link,
  pdf: FileText,
  quiz: ListChecks,
};

const CARD_CLASS_NAME =
  "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary/10";

/** Creating a Quiz: Details -> Source -> Import (docs/specs/quiz-ai-import.md). */
type Step = "details" | "import" | "source";
type QuizSource = "ai" | "manual";
type PrimaryAction = "import" | "next" | "save";

const STEP_NUMBERS: Record<Step, number> = { details: 1, import: 3, source: 2 };

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
  isQuizCreation: boolean,
  quizSource: QuizSource | null
): PrimaryAction {
  if (step === "import") {
    return "import";
  }
  if (step === "details") {
    return isQuizCreation ? "next" : "save";
  }
  return quizSource === "manual" ? "save" : "next";
}

interface ActivityFormDialogProps {
  activity: Activity | null;
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
  onImportQuiz,
  onOpenChange,
  onSubmit,
  open,
}: ActivityFormDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [type, setType] = useState<string>(
    activity?.type ?? MVP_ACTIVITY_TYPES[0]
  );
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
      setType(activity?.type ?? MVP_ACTIVITY_TYPES[0]);
      setUrl(activity?.url ?? "");
      setFilePath(activity?.filePath ?? null);
      setStep("details");
      setQuizSource(null);
      setImportedQuestions(null);
    }
  }, [open, activity]);

  const isQuizCreation = !activity && type === "quiz";
  const importCount = importedQuestions?.length ?? 0;
  const primaryAction = primaryActionFor(step, isQuizCreation, quizSource);

  const goTo = useCallback((next: Step, back = false) => {
    setMovingBack(back);
    setStep(next);
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (primaryAction === "next") {
        goTo(step === "details" ? "source" : "import");
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

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const primaryActionLabels: Record<PrimaryAction, string> = {
    import: t("quizImportCreateAction", { count: importCount }),
    next: t("nextStepAction"),
    save: t("saveAction"),
  };
  const isPrimaryDisabled =
    (step === "source" && !quizSource) ||
    (step === "import" && importCount === 0);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {activity ? t("editActivityTitle") : t("createActivityTitle")}
            </DialogTitle>
            {isQuizCreation ? (
              <StepIndicator
                current={STEP_NUMBERS[step]}
                total={quizSource === "manual" ? 2 : 3}
              />
            ) : null}
          </DialogHeader>
          <div
            className={cn(
              "fade-in-0 flex animate-in flex-col gap-4 py-4 duration-200",
              movingBack ? "slide-in-from-left-4" : "slide-in-from-right-4"
            )}
            key={step}
          >
            {step === "details" ? (
              <ActivityDetailsFields
                filePath={filePath}
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
  filePath: string | null;
  onFilePathChange: (filePath: string) => void;
  onTitleChange: (title: string) => void;
  onTypeChange: (type: string) => void;
  onUrlChange: (url: string) => void;
  title: string;
  type: string;
  url: string;
}

function ActivityDetailsFields({
  filePath,
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
          className="grid grid-cols-2 gap-2"
          onValueChange={onTypeChange}
          value={type}
        >
          {MVP_ACTIVITY_TYPES.map((activityType) => {
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
      {type === "pdf" && (
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
