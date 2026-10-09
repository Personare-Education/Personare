import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Program } from "@/components/programs-card-grid";
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
import {
  DEFAULT_PROGRAM_COLOR,
  DEFAULT_PROGRAM_ICON_NAME,
  PROGRAM_COLORS,
  PROGRAM_ICONS,
} from "@/constants/program-appearance";
import {
  DEFAULT_STUDY_GOAL,
  STUDY_GOALS,
  type StudyGoal,
} from "@/utils/study-goal";
import { cn } from "@/utils/tailwind";

export interface ProgramFormSubmitValues {
  color: string;
  icon: string;
  name: string;
  studyGoal: StudyGoal;
  /** The test's day, `yyyy-MM-dd`; null for "Nunca mais esquecer". */
  targetDate: string | null;
}

const STUDY_GOAL_TEXT: Record<
  StudyGoal,
  { description: string; title: string }
> = {
  retain: {
    description: "studyGoalRetainDescription",
    title: "studyGoalRetainTitle",
  },
  test_prep: {
    description: "studyGoalTestDescription",
    title: "studyGoalTestTitle",
  },
};

interface ProgramFormDialogProps {
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProgramFormSubmitValues) => void;
  open: boolean;
  program: Program | null;
}

export default function ProgramFormDialog({
  onOpenChange,
  onSubmit,
  open,
  program,
}: ProgramFormDialogProps) {
  const { t } = useTranslation();
  const nameInputId = useId();
  const targetDateInputId = useId();
  const studyGoalName = useId();
  const [name, setName] = useState(program?.name ?? "");
  const [icon, setIcon] = useState(program?.icon ?? DEFAULT_PROGRAM_ICON_NAME);
  const [color, setColor] = useState(program?.color ?? DEFAULT_PROGRAM_COLOR);
  const [studyGoal, setStudyGoal] = useState<StudyGoal>(
    program?.studyGoal ?? DEFAULT_STUDY_GOAL
  );
  const [targetDate, setTargetDate] = useState(program?.targetDate ?? "");

  useEffect(() => {
    if (open) {
      setName(program?.name ?? "");
      setIcon(program?.icon ?? DEFAULT_PROGRAM_ICON_NAME);
      setColor(program?.color ?? DEFAULT_PROGRAM_COLOR);
      setStudyGoal(program?.studyGoal ?? DEFAULT_STUDY_GOAL);
      setTargetDate(program?.targetDate ?? "");
    }
  }, [open, program]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit({
        color,
        icon,
        name,
        studyGoal,
        targetDate: studyGoal === "test_prep" ? targetDate : null,
      });
    },
    [color, icon, name, onSubmit, studyGoal, targetDate]
  );

  const handleStudyGoalChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setStudyGoal(event.target.value as StudyGoal);
    },
    []
  );

  const handleTargetDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTargetDate(event.target.value);
    },
    []
  );

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setName(event.target.value);
    },
    []
  );

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleIconClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const selected = event.currentTarget.dataset.iconName;
      if (selected) {
        setIcon(selected);
      }
    },
    []
  );

  const handleColorClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const selected = event.currentTarget.dataset.color;
      if (selected) {
        setColor(selected);
      }
    },
    []
  );

  const SelectedIcon =
    PROGRAM_ICONS.find((entry) => entry.name === icon)?.Icon ??
    PROGRAM_ICONS[0].Icon;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {program ? t("editProgramTitle") : t("createProgramTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex justify-center">
              <span
                className="flex size-16 items-center justify-center rounded-full"
                style={{ backgroundColor: color }}
              >
                <SelectedIcon className="size-7 text-white" />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("programIconLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {PROGRAM_ICONS.map(({ Icon, name: iconName }) => (
                  <button
                    aria-label={iconName}
                    aria-pressed={icon === iconName}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      icon === iconName &&
                        "border-ring bg-accent text-accent-foreground"
                    )}
                    data-icon-name={iconName}
                    key={iconName}
                    onClick={handleIconClick}
                    type="button"
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={nameInputId}>{t("programNameLabel")}</Label>
              <Input
                id={nameInputId}
                onChange={handleNameChange}
                required
                value={name}
              />
            </div>
            {/* The goal decides how reviews are scheduled
                (docs/architecture/scheduling.md D1). */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium text-sm">
                {t("studyGoalLabel")}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {STUDY_GOALS.map((goal) => (
                  <label
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-start transition-colors hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      studyGoal === goal &&
                        "border-brand/40 bg-brand/10 hover:bg-brand/10"
                    )}
                    key={goal}
                  >
                    <input
                      checked={studyGoal === goal}
                      className="sr-only"
                      name={studyGoalName}
                      onChange={handleStudyGoalChange}
                      type="radio"
                      value={goal}
                    />
                    <span className="font-medium text-sm">
                      {t(STUDY_GOAL_TEXT[goal].title)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t(STUDY_GOAL_TEXT[goal].description)}
                    </span>
                  </label>
                ))}
              </div>
              {studyGoal === "test_prep" ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={targetDateInputId}>
                    {t("targetDateLabel")}
                  </Label>
                  <Input
                    className="w-fit"
                    id={targetDateInputId}
                    onChange={handleTargetDateChange}
                    required
                    type="date"
                    value={targetDate}
                  />
                </div>
              ) : null}
            </fieldset>
            <div className="flex flex-col gap-1">
              <Label>{t("programColorLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {PROGRAM_COLORS.map((swatch) => (
                  <button
                    aria-label={swatch}
                    aria-pressed={color === swatch}
                    className={cn(
                      "size-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-background",
                      color === swatch && "ring-ring"
                    )}
                    data-color={swatch}
                    key={swatch}
                    onClick={handleColorClick}
                    style={{ backgroundColor: swatch }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCancelClick} type="button" variant="outline">
              {t("cancelAction")}
            </Button>
            <Button type="submit">{t("saveAction")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
