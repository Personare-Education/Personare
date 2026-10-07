import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSettings, setSoundsEnabled } from "@/actions/settings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setSoundsEnabled as applySounds } from "@/utils/sounds";

/**
 * "Sounds": the correct-answer and exam result sounds, on by default
 * (docs/specs/gamification.md §2 AC-3). A change applies at once.
 */
export default function SoundsToggle() {
  const { t } = useTranslation();
  const id = useId();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    getSettings()
      .then((settings) => setEnabled(settings.soundsEnabled))
      .catch(() => undefined);
  }, []);

  const handleChange = useCallback((checked: boolean) => {
    setEnabled(checked);
    applySounds(checked);
    setSoundsEnabled(checked);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} id={id} onCheckedChange={handleChange} />
        <Label htmlFor={id}>{t("soundsToggleLabel")}</Label>
      </div>
      <p className="text-muted-foreground text-sm">{t("soundsDescription")}</p>
    </div>
  );
}
