import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSettings, setDesiredRetention } from "@/actions/settings";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** The choices, from fewer reviews to more (docs/specs/desired-retention.md AC-4). */
export const DESIRED_RETENTION_CHOICES = [0.8, 0.85, 0.9, 0.95] as const;

const HINT_KEYS: Partial<Record<number, string>> = {
  0.8: "desiredRetentionFewerHint",
  0.9: "desiredRetentionRecommendedHint",
  0.95: "desiredRetentionExamHint",
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/**
 * Settings → General: how much of what comes due the student wants to
 * remember. FSRS schedules for it from the next rating on.
 */
export default function DesiredRetentionToggle() {
  const { t } = useTranslation();
  const [value, setValue] = useState(0.9);

  useEffect(() => {
    getSettings()
      .then((settings) => setValue(settings.desiredRetention))
      .catch(() => undefined);
  }, []);

  const handleValueChange = useCallback((next: string) => {
    // A single toggle group reports "" when the pressed item is clicked again.
    if (!next) {
      return;
    }
    const retention = Number(next);
    setValue(retention);
    setDesiredRetention(retention);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold text-sm">{t("desiredRetentionLabel")}</h3>
      <ToggleGroup
        aria-label={t("desiredRetentionLabel")}
        onValueChange={handleValueChange}
        type="single"
        value={String(value)}
      >
        {DESIRED_RETENTION_CHOICES.map((choice) => {
          const hintKey = HINT_KEYS[choice];
          const label = hintKey
            ? `${percent(choice)}, ${t(hintKey)}`
            : percent(choice);
          return (
            <ToggleGroupItem
              aria-label={label}
              className="data-[state=on]:border-brand/40 data-[state=on]:bg-brand/10 data-[state=on]:text-brand-text"
              key={choice}
              size="lg"
              title={label}
              value={String(choice)}
              variant="outline"
            >
              {percent(choice)}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <p className="text-muted-foreground text-sm">
        {t("desiredRetentionDescription")}
      </p>
    </div>
  );
}
