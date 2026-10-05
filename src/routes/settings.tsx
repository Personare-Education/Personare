import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import AccountSection from "@/components/account-section";
import BackupExportDialog from "@/components/backup-export-dialog";
import BackupImportDialog from "@/components/backup-import-dialog";
import DriveBackupDialog from "@/components/drive-backup-dialog";
import DriveRestoreDialog from "@/components/drive-restore-dialog";
import PrereleaseUpdatesToggle from "@/components/prerelease-updates-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsState } from "@/hooks/use-settings-state";

export function SettingsPage() {
  const { t } = useTranslation();
  const {
    autoStartEnabled,
    autoStartId,
    handleAutoStartChange,
    handleDriveBackupClick,
    handleDriveRestoreClick,
    handleExportClick,
    handleImportClick,
    importFilePath,
    isDriveBackupDialogOpen,
    isDriveConnected,
    isDriveRestoreDialogOpen,
    isExportDialogOpen,
    isImportDialogOpen,
    setIsDriveBackupDialogOpen,
    setIsDriveConnected,
    setIsDriveRestoreDialogOpen,
    setIsExportDialogOpen,
    setIsImportDialogOpen,
  } = useSettingsState();

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <h1 className="font-medium font-serif text-3xl tracking-[-0.02em]">
        {t("settingsPageTitle")}
      </h1>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={autoStartEnabled}
            id={autoStartId}
            onCheckedChange={handleAutoStartChange}
          />
          <Label htmlFor={autoStartId}>{t("autoStartToggleLabel")}</Label>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("autoStartDescription")}
        </p>
      </div>
      <PrereleaseUpdatesToggle />
      <AccountSection onDriveConnectedChange={setIsDriveConnected} />
      <div className="flex flex-col gap-2">
        <h2 className="font-medium font-serif text-xl">
          {t("backupSectionTitle")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("backupSectionDescription")}
        </p>
        <div className="flex gap-2">
          <Button onClick={handleExportClick} variant="outline">
            {t("exportBackupAction")}
          </Button>
          <Button onClick={handleImportClick} variant="outline">
            {t("importBackupAction")}
          </Button>
        </div>
      </div>
      {isDriveConnected ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-medium font-serif text-xl">
            {t("driveBackupSectionTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("driveBackupSectionDescription")}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleDriveBackupClick} variant="outline">
              {t("backupToDriveAction")}
            </Button>
            <Button onClick={handleDriveRestoreClick} variant="outline">
              {t("restoreFromDriveAction")}
            </Button>
          </div>
        </div>
      ) : null}
      <BackupExportDialog
        onOpenChange={setIsExportDialogOpen}
        open={isExportDialogOpen}
      />
      <BackupImportDialog
        filePath={importFilePath}
        onOpenChange={setIsImportDialogOpen}
        open={isImportDialogOpen}
      />
      <DriveBackupDialog
        onOpenChange={setIsDriveBackupDialogOpen}
        open={isDriveBackupDialogOpen}
      />
      <DriveRestoreDialog
        onOpenChange={setIsDriveRestoreDialogOpen}
        open={isDriveRestoreDialogOpen}
      />
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
