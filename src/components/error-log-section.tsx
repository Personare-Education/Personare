import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { selectErrorLogExportPath } from "@/actions/dialog";
import { exportErrorLog } from "@/actions/error-log";
import { Button } from "@/components/ui/button";

/**
 * Settings → Diagnostics (docs/specs/error-log.md AC-5): the error log stays
 * on this computer; exporting it is how the student chooses to share it.
 */
export default function ErrorLogSection() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);

  const handleExportClick = useCallback(async () => {
    setMessage(null);
    const filePath = await selectErrorLogExportPath();
    if (!filePath) {
      return;
    }
    try {
      const { exported } = await exportErrorLog(filePath);
      setMessage(
        exported ? t("errorLogExportedMessage") : t("errorLogEmptyMessage")
      );
    } catch {
      setMessage(t("errorLogExportErrorMessage"));
    }
  }, [t]);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-medium font-serif text-xl">
        {t("diagnosticsSectionTitle")}
      </h2>
      <p className="text-muted-foreground text-sm">
        {t("diagnosticsSectionDescription")}
      </p>
      <div className="flex gap-2">
        <Button onClick={handleExportClick} variant="outline">
          {t("exportErrorLogAction")}
        </Button>
      </div>
      {message ? (
        <p className="text-muted-foreground text-sm" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
