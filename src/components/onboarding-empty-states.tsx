import { BookOpen, FileStack, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import EmptyState from "@/components/empty-state";
import { Button } from "@/components/ui/button";

interface OnboardingEmptyStateProps {
  onCreate: () => void;
}

/**
 * No programs yet: what a program is (docs/specs/onboard-empty-states.md
 * AC-3), and importing a whole one (docs/specs/program-import.md §3 AC-1).
 */
export function ProgramsEmptyState({
  onCreate,
  onImport,
}: OnboardingEmptyStateProps & { onImport?: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      action={
        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreate}>{t("createProgramAction")}</Button>
          {onImport ? (
            <Button onClick={onImport} variant="outline">
              {t("importProgramAction")}
            </Button>
          ) : null}
        </div>
      }
      icon={BookOpen}
      message={t("programsEmptyMessage")}
      title={t("programsEmptyTitle")}
    />
  );
}

/** No modules yet: what a module is (AC-4). */
export function ModulesEmptyState({ onCreate }: OnboardingEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <EmptyState
      action={<Button onClick={onCreate}>{t("createModuleAction")}</Button>}
      icon={FolderOpen}
      message={t("modulesEmptyMessage")}
      title={t("modulesEmptyTitle")}
    />
  );
}

/** No activities yet: the kinds there are, and that each comes back (AC-5). */
export function ActivitiesEmptyState({ onCreate }: OnboardingEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <EmptyState
      action={<Button onClick={onCreate}>{t("createActivityAction")}</Button>}
      icon={FileStack}
      message={t("activitiesEmptyMessage")}
      title={t("activitiesEmptyTitle")}
    />
  );
}
