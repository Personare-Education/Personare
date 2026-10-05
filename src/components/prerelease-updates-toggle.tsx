import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSettings, setTestPrereleases } from "@/actions/settings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * "Test pre-releases": the update channel the app asks for, on by default
 * during the beta (docs/specs/prerelease-updates.md AC-1). Read at launch,
 * so a change applies the next time the app opens.
 */
export default function PrereleaseUpdatesToggle() {
  const { t } = useTranslation();
  const id = useId();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    getSettings()
      .then((settings) => setEnabled(settings.testPrereleases))
      .catch(() => undefined);
  }, []);

  const handleChange = useCallback((checked: boolean) => {
    setEnabled(checked);
    setTestPrereleases(checked);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} id={id} onCheckedChange={handleChange} />
        <Label htmlFor={id}>{t("testPrereleasesToggleLabel")}</Label>
      </div>
      <p className="text-muted-foreground text-sm">
        {t("testPrereleasesDescription")}
      </p>
    </div>
  );
}
