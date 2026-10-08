import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/utils/tailwind";
import type { UnlockMode } from "@/utils/unlock";

const MODE_LABEL_KEYS: Record<UnlockMode, string> = {
  all: "unlockModeAll",
  any: "unlockModeAny",
  exam: "unlockModeExam",
  none: "unlockModeNone",
  previous: "unlockModePrevious",
  // An exam's own modules (docs/specs/exam-locks.md AC-5).
  sources: "unlockModeSources",
};

/** An activity's and a module's modes; a module's add "exam" (exams.md §4). */
const DEFAULT_MODES: UnlockMode[] = ["none", "previous", "any", "all"];

/** What a rule can require, grouped (activities by module). */
export interface UnlockCandidateGroup {
  /** `nested`: inside a sequence, shown under it. */
  items: { id: string; nested?: boolean; title: string }[];
  /** The group's name, or null for a single unnamed list. */
  label: string | null;
}

interface UnlockRuleDialogProps {
  candidates: UnlockCandidateGroup[];
  /** Why the last save was refused, shown above the buttons. */
  error?: string | null;
  /**
   * The exams it can wait for, which a module's rule offers ("After passing
   * an exam"); left out for an activity's.
   */
  exams?: { id: string; title: string }[];
  /** The rule as saved, to open on. */
  mode: string;
  /** The modes to offer, in order; by default an activity's or a module's. */
  modes?: UnlockMode[];
  onOpenChange: (open: boolean) => void;
  onSave: (mode: UnlockMode, requiredIds: string[]) => void;
  open: boolean;
  requiredIds: string[];
  /** What this rule unlocks. */
  subjectTitle: string;
}

const MODE_CARD_CLASS_NAME =
  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary/10";

/**
 * How an activity or a module unlocks (docs/specs/sequences-and-locks.md
 * §4 AC-1): free, after everything before it, or after any or all of a
 * chosen list.
 */
export default function UnlockRuleDialog({
  candidates,
  error = null,
  exams,
  mode,
  modes: modesProp,
  onOpenChange,
  onSave,
  open,
  requiredIds,
  subjectTitle,
}: UnlockRuleDialogProps) {
  const { t } = useTranslation();
  const modeLabelId = useId();
  const [selectedMode, setSelectedMode] = useState<UnlockMode>("none");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  // Kept the same between renders: the form resets when it changes.
  const offersExam = exams !== undefined;
  const modes = useMemo<UnlockMode[]>(
    () =>
      modesProp ?? [...DEFAULT_MODES, ...(offersExam ? ["exam" as const] : [])],
    [modesProp, offersExam]
  );

  useEffect(() => {
    if (open) {
      setSelectedMode(
        modes.includes(mode as UnlockMode) ? (mode as UnlockMode) : "none"
      );
      setSelectedIds(mode === "exam" ? [] : requiredIds);
      setSelectedExamId(mode === "exam" ? (requiredIds[0] ?? null) : null);
    }
  }, [mode, modes, open, requiredIds]);

  const takesList = selectedMode === "any" || selectedMode === "all";
  const takesExam = selectedMode === "exam";
  const canSave =
    (!takesList || selectedIds.length > 0) &&
    (!takesExam || (exams ?? []).some((exam) => exam.id === selectedExamId));

  const handleModeChange = useCallback((value: string) => {
    setSelectedMode(value as UnlockMode);
  }, []);

  const handleToggle = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((selected) => selected !== id)
    );
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSave) {
        return;
      }
      if (takesExam) {
        onSave("exam", selectedExamId ? [selectedExamId] : []);
        return;
      }
      // The list in screen order, whatever order it was checked in.
      const order = candidates.flatMap((group) =>
        group.items.map((item) => item.id)
      );
      onSave(
        selectedMode,
        takesList ? order.filter((id) => selectedIds.includes(id)) : []
      );
    },
    [
      canSave,
      candidates,
      onSave,
      selectedExamId,
      selectedIds,
      selectedMode,
      takesExam,
      takesList,
    ]
  );

  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);
  const hasCandidates = candidates.some((group) => group.items.length > 0);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] sm:max-w-md">
        <form className="flex min-h-0 flex-col gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("unlockRuleTitle", { title: subjectTitle })}
            </DialogTitle>
            <DialogDescription>{t("unlockRuleDescription")}</DialogDescription>
          </DialogHeader>
          <div className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
            <RadioGroupPrimitive.Root
              aria-labelledby={modeLabelId}
              className="flex flex-col gap-2"
              onValueChange={handleModeChange}
              value={selectedMode}
            >
              <span className="sr-only" id={modeLabelId}>
                {t("unlockRuleAction")}
              </span>
              {modes.map((option) => (
                <RadioGroupPrimitive.Item
                  className={MODE_CARD_CLASS_NAME}
                  key={option}
                  value={option}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input"
                  >
                    <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
                  </span>
                  {t(MODE_LABEL_KEYS[option])}
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
            {takesList ? (
              <div className="flex flex-col gap-3">
                {hasCandidates ? (
                  candidates.map((group) =>
                    group.items.length > 0 ? (
                      <CandidateGroup
                        group={group}
                        key={group.label ?? "items"}
                        onToggle={handleToggle}
                        selectedIds={selectedIds}
                      />
                    ) : null
                  )
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t("unlockNoCandidatesMessage")}
                  </p>
                )}
              </div>
            ) : null}
            {takesExam ? (
              <ExamChoices
                exams={exams ?? []}
                onChange={setSelectedExamId}
                selectedId={selectedExamId}
              />
            ) : null}
          </div>
          {error ? (
            <p className="text-destructive-text text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={handleCancel} type="button" variant="outline">
              {t("cancelAction")}
            </Button>
            <Button disabled={!canSave} type="submit">
              {t("saveAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CandidateGroupProps {
  group: UnlockCandidateGroup;
  onToggle: (id: string, checked: boolean) => void;
  selectedIds: string[];
}

function CandidateGroup({ group, onToggle, selectedIds }: CandidateGroupProps) {
  const labelId = useId();

  return (
    // biome-ignore lint/a11y/useSemanticElements: a named group of checkboxes; a fieldset's legend would not take this layout.
    <div
      aria-labelledby={group.label ? labelId : undefined}
      className="flex flex-col gap-1"
      role="group"
    >
      {group.label ? (
        <span
          className="font-medium text-muted-foreground text-xs"
          id={labelId}
        >
          {group.label}
        </span>
      ) : null}
      {group.items.map((item) => (
        <CandidateItem
          checked={selectedIds.includes(item.id)}
          id={item.id}
          key={item.id}
          nested={item.nested ?? false}
          onToggle={onToggle}
          title={item.title}
        />
      ))}
    </div>
  );
}

interface CandidateItemProps {
  checked: boolean;
  id: string;
  nested: boolean;
  onToggle: (id: string, checked: boolean) => void;
  title: string;
}

function CandidateItem({
  checked,
  id,
  nested,
  onToggle,
  title,
}: CandidateItemProps) {
  const inputId = useId();
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onToggle(id, event.target.checked);
    },
    [id, onToggle]
  );

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
        // A sequence's activities sit under it.
        nested && "ms-6"
      )}
      htmlFor={inputId}
    >
      <input
        checked={checked}
        className="size-4 shrink-0 accent-[var(--primary)]"
        id={inputId}
        onChange={handleChange}
        type="checkbox"
      />
      {title}
    </label>
  );
}

interface ExamChoicesProps {
  exams: { id: string; title: string }[];
  onChange: (id: string) => void;
  selectedId: string | null;
}

/** The one exam a module waits for (docs/specs/exams.md §4 AC-1). */
function ExamChoices({ exams, onChange, selectedId }: ExamChoicesProps) {
  const { t } = useTranslation();
  const labelId = useId();

  if (exams.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("unlockNoExamsMessage")}
      </p>
    );
  }

  return (
    <RadioGroupPrimitive.Root
      aria-labelledby={labelId}
      className="flex flex-col gap-1"
      onValueChange={onChange}
      value={selectedId ?? ""}
    >
      <span className="sr-only" id={labelId}>
        {t("unlockModeExam")}
      </span>
      {exams.map((exam) => (
        <RadioGroupPrimitive.Item
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring"
          key={exam.id}
          value={exam.id}
        >
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input"
          >
            <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
          </span>
          {exam.title}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
