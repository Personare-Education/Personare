import {
  CircleAlert,
  ClipboardCheck,
  FileUp,
  FolderOpen,
  Layers,
  Link,
  ListChecks,
  ListOrdered,
  Lock,
  type LucideIcon,
  Sparkles,
} from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { importProgram, previewProgramImport } from "@/actions/programs";
import { openExternalLink } from "@/actions/shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type FileWithPreview,
  useFileUpload,
} from "@/hooks/reui/use-file-upload";
import type {
  ImportActivityReport,
  ImportExamReport,
  ImportModuleReport,
  ImportReport,
  ImportRuleIssue,
} from "@/ipc/shared/program-import";
import {
  AI_PROVIDERS,
  type AiProvider,
  promptLanguage,
} from "@/utils/ai-providers";
import {
  buildProgramPrompt,
  type ParsedRule,
  type ProgramWarningReason,
} from "@/utils/program-markdown";
import { cn } from "@/utils/tailwind";

type Step = "file" | "preview" | "prompt";

interface ProgramImportDialogProps {
  /** Imported: the caller opens the program and offers Undo (§3 AC-3). */
  onImported: (report: ImportReport) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const ACTIVITY_ICONS: Record<ImportActivityReport["type"], LucideIcon> = {
  flashcards: Layers,
  link: Link,
  quiz: ListChecks,
  sequence: ListOrdered,
};

const RULE_ISSUE_KEYS: Record<ImportRuleIssue, string> = {
  examDrawsFromModule: "programImportRuleExamDrawsFromModule",
  keptExisting: "programImportRuleKeptExisting",
  unknownName: "programImportRuleUnknownName",
  wouldLockForGood: "programImportRuleWouldLockForGood",
};

const WARNING_KEYS: Record<ProgramWarningReason, string> = {
  emptyActivity: "programImportWarningEmptyActivity",
  invalidRule: "programImportWarningInvalidRule",
  missingBack: "programImportWarningMissingBack",
  missingProgram: "programImportMissingProgram",
  missingText: "programImportWarningMissingText",
  missingUrl: "programImportWarningMissingUrl",
  multipleCorrectOptions: "programImportWarningMultipleCorrectOptions",
  noCorrectOption: "programImportWarningNoCorrectOption",
  notInSequence: "programImportWarningNotInSequence",
  tooFewOptions: "programImportWarningTooFewOptions",
  unknownBlock: "programImportWarningUnknownBlock",
};

/**
 * Importing a whole program (docs/specs/program-import.md §3): send the
 * prompt to an AI, bring its file back (dropped or pasted), see what the
 * import would do, then import.
 */
export default function ProgramImportDialog({
  onImported,
  onOpenChange,
  open,
}: ProgramImportDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("prompt");
  const [markdown, setMarkdown] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [missingProgram, setMissingProgram] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("prompt");
      setMarkdown("");
      setReport(null);
      setMissingProgram(false);
      setIsImporting(false);
    }
  }, [open]);

  const preview = useCallback((text: string) => {
    setMarkdown(text);
    previewProgramImport(text)
      .then((result) => {
        setReport(result as ImportReport);
        setMissingProgram(false);
      })
      .catch(() => {
        setReport(null);
        setMissingProgram(true);
      })
      .finally(() => setStep("preview"));
  }, []);

  const handleImport = useCallback(() => {
    setIsImporting(true);
    importProgram(markdown)
      .then((result) => onImported(result as ImportReport))
      .finally(() => setIsImporting(false));
  }, [markdown, onImported]);

  const toPrompt = useCallback(() => setStep("prompt"), []);
  const toFile = useCallback(() => setStep("file"), []);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("importProgramTitle")}</DialogTitle>
          <DialogDescription>
            {t(`programImportStep_${step}`)}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 overflow-y-auto px-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          {step === "prompt" ? <PromptStep /> : null}
          {step === "file" ? <FileStep onText={preview} /> : null}
          {step === "preview" && missingProgram ? (
            <p className="flex items-start gap-2 text-destructive-text text-sm">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              {t("programImportMissingProgram")}
            </p>
          ) : null}
          {step === "preview" && report ? (
            <ImportPreview report={report} />
          ) : null}
        </div>
        <DialogFooter>
          {step === "prompt" ? (
            <Button onClick={toFile} type="button">
              {t("programImportHaveFileAction")}
            </Button>
          ) : null}
          {step === "file" ? (
            <Button onClick={toPrompt} type="button" variant="outline">
              {t("previousStepAction")}
            </Button>
          ) : null}
          {step === "preview" && missingProgram ? (
            <Button onClick={toPrompt} type="button" variant="outline">
              {t("programImportBackToPromptAction")}
            </Button>
          ) : null}
          {step === "preview" && report ? (
            <>
              <Button onClick={toFile} type="button" variant="outline">
                {t("previousStepAction")}
              </Button>
              <Button
                disabled={isImporting}
                onClick={handleImport}
                type="button"
              >
                {t("programImportAction")}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The topic, any extra instructions, and the AI to send the prompt to. */
function PromptStep() {
  const { i18n, t } = useTranslation();
  const topicId = useId();
  const extraId = useId();
  const aiId = useId();
  const [topic, setTopic] = useState("");
  const [extra, setExtra] = useState("");
  const [provider, setProvider] = useState<AiProvider>("chatgpt");
  const [copiedFor, setCopiedFor] = useState<AiProvider | null>(null);

  const handleTopicChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setTopic(event.target.value);
      setCopiedFor(null);
    },
    []
  );
  const handleExtraChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setExtra(event.target.value),
    []
  );
  const handleProviderChange = useCallback((value: string) => {
    setProvider(value as AiProvider);
    setCopiedFor(null);
  }, []);

  const handleSend = useCallback(async () => {
    const prompt = buildProgramPrompt({
      extraInstructions: extra,
      language: promptLanguage(i18n.language),
      topic,
    });
    await navigator.clipboard.writeText(prompt);
    openExternalLink(AI_PROVIDERS[provider].url(prompt));
    setCopiedFor(provider);
  }, [extra, i18n.language, provider, topic]);

  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={topicId}>{t("programImportTopicLabel")}</Label>
          <Input
            id={topicId}
            onChange={handleTopicChange}
            placeholder={t("programImportTopicPlaceholder")}
            value={topic}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={aiId}>{t("quizImportAiLabel")}</Label>
          <Select onValueChange={handleProviderChange} value={provider}>
            <SelectTrigger className="w-32" id={aiId}>
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
      <div className="flex flex-col gap-1">
        <Label htmlFor={extraId}>{t("programImportExtraLabel")}</Label>
        <Textarea
          id={extraId}
          onChange={handleExtraChange}
          placeholder={t("programImportExtraPlaceholder")}
          rows={2}
          value={extra}
        />
      </div>
      <Button
        disabled={!topic.trim()}
        onClick={handleSend}
        type="button"
        variant="outline"
      >
        <Sparkles />
        {t("quizImportSendPromptAction", { ai: AI_PROVIDERS[provider].label })}
      </Button>
      {copiedFor ? (
        <p className="text-muted-foreground text-sm">
          {t(
            AI_PROVIDERS[copiedFor].prefill
              ? "programImportPromptCopied"
              : "programImportPromptCopiedPaste",
            { ai: AI_PROVIDERS[copiedFor].label }
          )}
        </p>
      ) : null}
    </div>
  );
}

/** The AI's file, dropped or picked, or its text pasted. */
function FileStep({ onText }: { onText: (text: string) => void }) {
  const { t } = useTranslation();
  const pasteId = useId();
  const [pasted, setPasted] = useState("");

  const readFile = useCallback(
    async ([added]: FileWithPreview[]) => {
      if (added?.file instanceof File) {
        onText(await added.file.text());
      }
    },
    [onText]
  );
  const [
    { errors, isDragging },
    {
      getInputProps,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
    },
  ] = useFileUpload({ accept: ".md,text/markdown", onFilesAdded: readFile });

  const handlePasteChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setPasted(event.target.value),
    []
  );
  const handlePreview = useCallback(() => onText(pasted), [onText, pasted]);

  return (
    <div className="flex flex-col gap-4 py-1">
      {/* The whole drop area is a button: click or Enter opens the file picker. */}
      <button
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-center text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring",
          isDragging && "border-primary bg-primary/10"
        )}
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
          {t("quizImportDropzoneHint")}
        </span>
      </button>
      <input
        {...getInputProps()}
        aria-label={t("quizImportDropzoneLabel")}
        className="sr-only"
        tabIndex={-1}
      />
      {errors.length > 0 ? (
        <p className="text-destructive-text text-sm">
          {t("quizImportInvalidFileMessage")}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor={pasteId}>{t("programImportPasteLabel")}</Label>
        <Textarea
          className="font-mono text-xs"
          id={pasteId}
          onChange={handlePasteChange}
          rows={6}
          value={pasted}
        />
      </div>
      <Button
        className="self-end"
        disabled={!pasted.trim()}
        onClick={handlePreview}
        type="button"
        variant="outline"
      >
        {t("programImportPreviewAction")}
      </Button>
    </div>
  );
}

/** A rule as the file wrote it: "Libera depois de: A, B". */
function useRuleText(): (rule: ParsedRule) => string {
  const { t } = useTranslation();
  return (rule) => {
    const names = rule.names.join(", ");
    const texts: Record<ParsedRule["mode"], string> = {
      all: names,
      any: t("programImportRuleAny", { names }),
      exam: t("programImportRuleExam", { name: names }),
      previous: t("programImportRulePrevious"),
      sources: t("programImportRuleSources"),
    };
    return `${t("programImportRuleLabel")} ${texts[rule.mode]}`;
  };
}

function RuleLine({
  issue,
  rule,
}: {
  issue: ImportRuleIssue | undefined;
  rule: ParsedRule | null;
}) {
  const { t } = useTranslation();
  const ruleText = useRuleText();
  if (!rule) {
    return null;
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
      <span className={cn("flex items-center gap-1", issue && "line-through")}>
        <Lock aria-hidden="true" className="size-3" />
        {ruleText(rule)}
      </span>
      {issue ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <CircleAlert aria-hidden="true" className="size-3 text-warning" />
          {t(RULE_ISSUE_KEYS[issue])}
        </span>
      ) : null}
    </span>
  );
}

function countText(
  t: (key: string, options?: Record<string, unknown>) => string,
  activity: ImportActivityReport
): string | null {
  if (activity.type === "quiz") {
    return t("examQuestionCount", { count: activity.count });
  }
  if (activity.type === "flashcards") {
    return t("programImportCards", { count: activity.count });
  }
  return activity.type === "sequence"
    ? t("programImportSteps", { count: activity.count })
    : null;
}

function ActivityItem({ activity }: { activity: ImportActivityReport }) {
  const { t } = useTranslation();
  const Icon = ACTIVITY_ICONS[activity.type];
  const count = countText(t, activity);
  return (
    <li aria-label={activity.title} className="flex flex-col gap-1">
      <span
        className={cn(
          "flex flex-wrap items-center gap-x-2 text-sm",
          activity.skipped && "text-muted-foreground"
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span>{activity.title}</span>
        {count ? (
          <span className="text-muted-foreground text-xs">{count}</span>
        ) : null}
        {activity.skipped ? (
          <span className="text-muted-foreground text-xs">
            {t("programImportAlreadyThere")}
          </span>
        ) : null}
      </span>
      {activity.steps && activity.steps.length > 0 ? (
        <ul className="ms-6 flex flex-col gap-1">
          {activity.steps.map((step, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the preview is rebuilt whole for every file and never reordered.
            <ActivityItem activity={step} key={index} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ModuleItem({ module }: { module: ImportModuleReport }) {
  const { t } = useTranslation();
  return (
    <li aria-label={module.name} className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-x-2 font-medium text-sm">
        <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
        {module.name}
        <span className="font-normal text-muted-foreground text-xs">
          {module.existed ? t("programImportExisting") : t("programImportNew")}
        </span>
      </span>
      <div className="ms-6 flex flex-col gap-1">
        <RuleLine issue={module.ruleIssue} rule={module.rule} />
        {module.activities.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {module.activities.map((activity, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the preview is rebuilt whole for every file and never reordered.
              <ActivityItem activity={activity} key={index} />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function ExamItem({ exam }: { exam: ImportExamReport }) {
  const { t } = useTranslation();
  return (
    <li aria-label={exam.title} className="flex flex-col gap-1">
      <span
        className={cn(
          "flex flex-wrap items-center gap-x-2 font-medium text-sm",
          exam.skipped && "text-muted-foreground"
        )}
      >
        <ClipboardCheck aria-hidden="true" className="size-4 shrink-0" />
        {exam.title}
        {exam.reason === "exists" ? (
          <span className="font-normal text-xs">
            {t("programImportAlreadyThere")}
          </span>
        ) : null}
      </span>
      <div className="ms-6 flex flex-col gap-1 text-xs">
        <RuleLine issue={exam.ruleIssue} rule={exam.rule} />
        {exam.droppedModules.length > 0 ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CircleAlert aria-hidden="true" className="size-3 text-warning" />
            {t("programImportDroppedModules", {
              names: exam.droppedModules.join(", "),
            })}
          </span>
        ) : null}
        {exam.reason === "noModules" ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CircleAlert aria-hidden="true" className="size-3 text-warning" />
            {t("programImportExamNoModules")}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** What the import would do, as a tree, and the reader's warnings. */
function ImportPreview({ report }: { report: ImportReport }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 py-1">
      <p className="font-medium">
        {report.programExisted
          ? t("programImportCompletes", { name: report.programName })
          : t("programImportCreates", { name: report.programName })}
      </p>
      <ul aria-label={report.programName} className="flex flex-col gap-3">
        {report.modules.map((module, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the preview is rebuilt whole for every file and never reordered.
          <ModuleItem key={index} module={module} />
        ))}
        {report.exams.map((exam, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the preview is rebuilt whole for every file and never reordered.
          <ExamItem exam={exam} key={`exam-${index}`} />
        ))}
      </ul>
      {report.warnings.length > 0 ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{t("programImportWarningsTitle")}</p>
          {report.warnings.map((warning) => (
            <p
              className="flex items-start gap-1.5 text-muted-foreground"
              key={`${warning.line}-${warning.reason}`}
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-warning"
              />
              {t(WARNING_KEYS[warning.reason], { line: warning.line })}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
