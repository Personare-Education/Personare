import { useNavigate } from "@tanstack/react-router";
import {
  Cloud,
  HardDrive,
  KeyRound,
  Languages,
  LifeBuoy,
  Settings2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAppVersion } from "@/actions/app";
import AccountSection from "@/components/account-section";
import BackupExportDialog from "@/components/backup-export-dialog";
import BackupImportDialog from "@/components/backup-import-dialog";
import BetaActivationSection from "@/components/beta-activation-section";
import DesiredRetentionToggle from "@/components/desired-retention-toggle";
import DriveBackupDialog from "@/components/drive-backup-dialog";
import DriveRestoreDialog from "@/components/drive-restore-dialog";
import ErrorLogSection from "@/components/error-log-section";
import LangToggle from "@/components/lang-toggle";
import PrereleaseUpdatesToggle from "@/components/prerelease-updates-toggle";
import SoundsToggle from "@/components/sounds-toggle";
import TextSizeToggle from "@/components/text-size-toggle";
import ToggleTheme from "@/components/toggle-theme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsState } from "@/hooks/use-settings-state";
import { cn } from "@/utils/tailwind";

type SettingsCategory =
  | "account"
  | "backup"
  | "beta"
  | "diagnostics"
  | "driveBackup"
  | "general";

interface SettingsDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface SettingsCategoryButtonProps {
  active: boolean;
  icon: typeof Settings2;
  id: SettingsCategory;
  label: string;
  onSelect: (id: SettingsCategory) => void;
}

function SettingsCategoryButton({
  active,
  icon: Icon,
  id,
  label,
  onSelect,
}: SettingsCategoryButtonProps) {
  const handleClick = useCallback(() => {
    onSelect(id);
  }, [onSelect, id]);

  return (
    <button
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-muted",
        active && "bg-muted font-medium text-foreground"
      )}
      onClick={handleClick}
      type="button"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

/**
 * The version in use, for the dialog's footer
 * (docs/specs/settings-language-text-size-version.md AC-8).
 */
function useAppVersion() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAppVersion()
      .then((value) => {
        if (!cancelled) {
          setVersion(value);
        }
      })
      .catch(() => {
        // No version to show: the footer stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}

export default function SettingsDialog({
  onOpenChange,
  open,
}: SettingsDialogProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("general");
  const navigate = useNavigate();
  const version = useAppVersion();

  // docs/specs/replay-welcome.md AC-2: back to Today's welcome.
  const handleReplayWelcomeClick = useCallback(() => {
    onOpenChange(false);
    navigate({ search: { welcome: true }, to: "/" });
  }, [navigate, onOpenChange]);
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

  const categories: {
    icon: typeof Settings2;
    id: SettingsCategory;
    label: string;
  }[] = [
    {
      icon: Settings2,
      id: "general",
      label: t("settingsGeneralCategoryLabel"),
    },
    { icon: User, id: "account", label: t("accountSectionTitle") },
    { icon: KeyRound, id: "beta", label: t("betaSectionTitle") },
    { icon: HardDrive, id: "backup", label: t("backupSectionTitle") },
    {
      icon: Cloud,
      id: "driveBackup",
      label: t("driveBackupSectionTitle"),
    },
    {
      icon: LifeBuoy,
      id: "diagnostics",
      label: t("diagnosticsSectionTitle"),
    },
  ];

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="flex h-[560px] max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="border-b p-4">
            <DialogTitle>{t("settingsPageTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 overflow-hidden">
            <nav className="flex w-44 shrink-0 flex-col gap-1 border-e bg-muted/30 p-2">
              {categories.map((category) => (
                <SettingsCategoryButton
                  active={activeCategory === category.id}
                  icon={category.icon}
                  id={category.id}
                  key={category.id}
                  label={category.label}
                  onSelect={setActiveCategory}
                />
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto p-4">
              {activeCategory === "general" && (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-1.5 font-semibold text-sm">
                      <Languages aria-hidden className="size-4" />
                      {t("languageLabel")}
                    </h3>
                    <LangToggle />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-sm">
                      {t("textSizeLabel")}
                    </h3>
                    <TextSizeToggle />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-sm">{t("themeLabel")}</h3>
                    <ToggleTheme />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={autoStartEnabled}
                        id={autoStartId}
                        onCheckedChange={handleAutoStartChange}
                      />
                      <Label htmlFor={autoStartId}>
                        {t("autoStartToggleLabel")}
                      </Label>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {t("autoStartDescription")}
                    </p>
                  </div>
                  <DesiredRetentionToggle />
                  <PrereleaseUpdatesToggle />
                  <SoundsToggle />
                  <div className="flex flex-col items-start gap-2">
                    <h3 className="font-semibold text-sm">
                      {t("replayWelcomeTitle")}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {t("replayWelcomeDescription")}
                    </p>
                    <Button
                      onClick={handleReplayWelcomeClick}
                      variant="outline"
                    >
                      {t("replayWelcomeAction")}
                    </Button>
                  </div>
                </div>
              )}
              {activeCategory === "account" && (
                <AccountSection onDriveConnectedChange={setIsDriveConnected} />
              )}
              {activeCategory === "beta" && <BetaActivationSection />}
              {activeCategory === "backup" && (
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
              )}
              {activeCategory === "driveBackup" &&
                (isDriveConnected ? (
                  <div className="flex flex-col gap-2">
                    <h2 className="font-medium font-serif text-xl">
                      {t("driveBackupSectionTitle")}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {t("driveBackupSectionDescription")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDriveBackupClick}
                        variant="outline"
                      >
                        {t("backupToDriveAction")}
                      </Button>
                      <Button
                        onClick={handleDriveRestoreClick}
                        variant="outline"
                      >
                        {t("restoreFromDriveAction")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t("driveBackupNotConnectedHint")}
                  </p>
                ))}
              {activeCategory === "diagnostics" && <ErrorLogSection />}
            </div>
          </div>
          <footer className="flex h-9 shrink-0 items-center justify-end border-t px-4 text-muted-foreground text-xs">
            {version && t("settingsVersionLabel", { version })}
          </footer>
        </DialogContent>
      </Dialog>
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
    </>
  );
}
