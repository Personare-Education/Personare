// biome-ignore-all lint/style/useFilenamingConvention: TanStack Router file-based routing requires the "$paramName" filename convention for dynamic route segments.
import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useTranslation } from "react-i18next";
import {
  createModule,
  listModules,
  restoreModule,
  softDeleteModule,
  updateModule,
} from "@/actions/modules";
import { listPrograms } from "@/actions/programs";
import DeleteModuleDialog from "@/components/delete-module-dialog";
import ModuleFormDialog from "@/components/module-form-dialog";
import ModulesDataTable, { type Module } from "@/components/modules-data-table";
import { ModulesEmptyState } from "@/components/onboarding-empty-states";
import OrganizeHeader from "@/components/organize-header";
import { BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useFocusedModuleRedirect } from "@/hooks/use-focused-module-redirect";
import { useReviewSchedule } from "@/hooks/use-review-schedule";
import {
  type ReviewHighlight,
  summarizeReviewUrgency,
  toReviewHighlight,
} from "@/utils/review-highlight";
import { showUndoToast } from "@/utils/undo-toast";

function ProgramModulesPage() {
  const { t } = useTranslation();
  const { programId } = Route.useParams();
  const { focusDate, focusModuleId } = Route.useSearch();
  const { rows: scheduleRows } = useReviewSchedule();
  const { openModule } = useFocusedModuleRedirect({
    focusDate,
    focusModuleId,
    programId,
  });
  const [modules, setModules] = useState<Module[]>([]);
  // The empty state waits for the first load, so it does not flash by.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [programName, setProgramName] = useState("");
  // The program's look, for the header (docs/specs/organize-identity.md).
  const [programColor, setProgramColor] = useState<string | null>(null);
  const [programIcon, setProgramIcon] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [formModule, setFormModule] = useState<Module | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [modulePendingDelete, setModulePendingDelete] = useState<Module | null>(
    null
  );

  const refreshModules = useCallback(() => {
    startTransition(() => {
      listModules(programId).then((loaded) => {
        setModules(loaded);
        setHasLoaded(true);
      });
    });
  }, [programId]);

  useEffect(() => {
    refreshModules();
  }, [refreshModules]);

  useEffect(() => {
    listPrograms().then((programs) => {
      const program = programs.find((item) => item.id === programId);
      setProgramName(program?.name ?? "");
      setProgramColor(program?.color ?? null);
      setProgramIcon(program?.icon ?? null);
    });
  }, [programId]);

  // Modules with pending reviews pulse, and so does the one in focus from
  // the calendar until it opens (docs/specs/calendar-module-review-highlight.md).
  const highlightByModuleId = useMemo(() => {
    const { byModuleId } = summarizeReviewUrgency(scheduleRows, new Date());

    return Object.fromEntries(
      modules.map((module) => [
        module.id,
        toReviewHighlight(byModuleId[module.id], module.id === focusModuleId),
      ])
    ) as Record<string, ReviewHighlight | undefined>;
  }, [focusModuleId, modules, scheduleRows]);

  const handleCreateClick = useCallback(() => {
    setFormModule(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((module: Module) => {
    setFormModule(module);
    setIsFormOpen(true);
  }, []);

  const handleRequestDelete = useCallback((module: Module) => {
    setModulePendingDelete(module);
  }, []);

  const handleNavigateToActivities = useCallback(
    (module: Module) => openModule(module.id),
    [openModule]
  );

  const handleFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open);
  }, []);

  const handleFormSubmit = useCallback(
    (name: string) => {
      const submit = formModule
        ? updateModule(formModule.id, name)
        : createModule(programId, name);

      submit.then(() => {
        setIsFormOpen(false);
        refreshModules();
      });
    },
    [formModule, programId, refreshModules]
  );

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setModulePendingDelete(null);
    }
  }, []);

  // Brings back what was just deleted (docs/specs/safety-net.md AC-2).
  const undoDelete = useCallback(
    (id: string) => {
      restoreModule(id).then(refreshModules);
    },
    [refreshModules]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!modulePendingDelete) {
      return;
    }

    const deleted = modulePendingDelete;
    softDeleteModule(deleted.id).then(() => {
      setModulePendingDelete(null);
      refreshModules();
      // docs/specs/safety-net.md AC-1
      showUndoToast({
        message: t("moduleDeletedMessage", { name: deleted.name }),
        onUndo: () => undoDelete(deleted.id),
        undoLabel: t("undoAction"),
      });
    });
  }, [modulePendingDelete, refreshModules, t, undoDelete]);

  const isEmpty = hasLoaded && modules.length === 0;

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <OrganizeHeader
        action={
          // One create button per area (docs/specs/onboard-empty-states.md AC-6).
          isEmpty ? null : (
            <Button onClick={handleCreateClick}>
              {t("createModuleAction")}
            </Button>
          )
        }
        color={programColor}
        crumbs={
          <BreadcrumbItem>
            <BreadcrumbPage>{programName}</BreadcrumbPage>
          </BreadcrumbItem>
        }
        icon={programIcon}
        title={programName}
      />
      {isEmpty ? (
        <ModulesEmptyState onCreate={handleCreateClick} />
      ) : (
        <ModulesDataTable
          highlightByModuleId={highlightByModuleId}
          modules={modules}
          onEdit={handleEdit}
          onNavigateToActivities={handleNavigateToActivities}
          onRequestDelete={handleRequestDelete}
        />
      )}
      <ModuleFormDialog
        module={formModule}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
      />
      <DeleteModuleDialog
        module={modulePendingDelete}
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        open={modulePendingDelete !== null}
      />
    </div>
  );
}

export const Route = createFileRoute("/programs/$programId/")({
  component: ProgramModulesPage,
});
