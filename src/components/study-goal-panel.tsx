import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { setProgramStudyGoal } from "@/actions/programs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { daysUntilTest } from "@/utils/scheduling-policy";
import { isDayKey, STUDY_GOALS, type StudyGoal } from "@/utils/study-goal";
import { cn } from "@/utils/tailwind";

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

/** How many days are left, next to the day (docs/specs/test-prep-scheduling.md AC-4). */
function TestCountdownText({ day }: { day: string }) {
  const { t } = useTranslation();
  if (!isDayKey(day)) {
    return null;
  }
  const days = daysUntilTest(day, new Date());
  if (days < 0) {
    return null;
  }
  return (
    <span className="font-medium text-brand-text text-xs tabular-nums">
      {days === 0 ? t("testToday") : t("testCountdown", { count: days })}
    </span>
  );
}

interface StudyGoalPanelProps {
  /** Called after a change is saved. */
  onChange?: () => void;
  programId: string;
  studyGoal: StudyGoal;
  targetDate: string | null;
}

/**
 * The program's goal, on its page above the modules
 * (docs/architecture/scheduling.md D1): "Nunca mais esquecer", the default,
 * or "Estudar para uma Prova" with the test's day. Saved as soon as it is
 * picked; the test is saved once its day is filled in.
 */
export default function StudyGoalPanel({
  onChange,
  programId,
  studyGoal,
  targetDate,
}: StudyGoalPanelProps) {
  const { t } = useTranslation();
  const name = useId();
  const dateId = useId();
  const [goal, setGoal] = useState<StudyGoal>(studyGoal);
  const [day, setDay] = useState(targetDate ?? "");

  useEffect(() => {
    setGoal(studyGoal);
    setDay(targetDate ?? "");
  }, [studyGoal, targetDate]);

  const save = useCallback(
    (nextGoal: StudyGoal, nextDay: string | null) => {
      setProgramStudyGoal(programId, nextGoal, nextDay)
        .then(() => onChange?.())
        .catch(() => undefined);
    },
    [onChange, programId]
  );

  const handleGoalChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value as StudyGoal;
      setGoal(next);
      if (next === "retain") {
        save("retain", null);
      } else if (isDayKey(day)) {
        save("test_prep", day);
      }
    },
    [day, save]
  );

  const handleDayChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setDay(next);
      if (isDayKey(next)) {
        save("test_prep", next);
      }
    },
    [save]
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-medium text-sm">
        {t("studyGoalLabel")}
      </legend>
      <div className="flex flex-wrap items-stretch gap-2">
        {STUDY_GOALS.map((option) => (
          <label
            className={cn(
              "flex max-w-xs flex-1 basis-56 cursor-pointer flex-col gap-1 rounded-lg border p-3 text-start transition-colors hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              goal === option && "border-brand/40 bg-brand/10 hover:bg-brand/10"
            )}
            key={option}
          >
            <input
              checked={goal === option}
              className="sr-only"
              name={name}
              onChange={handleGoalChange}
              type="radio"
              value={option}
            />
            <span className="font-medium text-sm">
              {t(STUDY_GOAL_TEXT[option].title)}
            </span>
            <span className="text-muted-foreground text-xs">
              {t(STUDY_GOAL_TEXT[option].description)}
            </span>
          </label>
        ))}
        {goal === "test_prep" ? (
          <div className="flex flex-col justify-center gap-1">
            <Label htmlFor={dateId}>{t("targetDateLabel")}</Label>
            <Input
              className="w-fit"
              id={dateId}
              onChange={handleDayChange}
              required
              type="date"
              value={day}
            />
            <TestCountdownText day={day} />
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
