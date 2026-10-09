import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useTranslation } from "react-i18next";
import {
  createProgram,
  groupActivityCountsByProgram,
  listProgramActivityCounts,
  listPrograms,
  type ProgramActivityCount,
  restoreProgram,
  softDeleteProgram,
  undoProgramImport,
  updateProgram,
} from "@/actions/programs";
import DeleteProgramDialog from "@/components/delete-program-dialog";
import { ProgramsEmptyState } from "@/components/onboarding-empty-states";
import ProgramFormDialog, {
  type ProgramFormSubmitValues,
} from "@/components/program-form-dialog";
import ProgramImportDialog from "@/components/program-import-dialog";
import ProgramsCardGrid, {
  type Program,
} from "@/components/programs-card-grid";
import { Button } from "@/components/ui/button";
import { useDataChanged } from "@/hooks/use-data-changed";
import { useDueReviews } from "@/hooks/use-due-count";
import type { ImportReport } from "@/ipc/shared/program-import";
import { showUndoToast } from "@/utils/undo-toast";

interface ProgramsSearch {
  /** Arrive with the new-program form open (the first run's "Create your first program"). */
  new?: true;
}

export function validateProgramsSearch(
  search: Record<string, unknown>
): ProgramsSearch {
  return search.new === true || search.new === "true" ? { new: true } : {};
}

export function ProgramsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ProgramsSearch;
  const [programs, setPrograms] = useState<Program[]>([]);
  // The empty state waits for the first load, so it does not flash by.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activityCounts, setActivityCounts] = useState<ProgramActivityCount[]>(
    []
  );
  const [, startTransition] = useTransition();
  const { byProgram: dueCountByProgramId } = useDueReviews();
  const [formProgram, setFormProgram] = useState<Program | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [programPendingDelete, setProgramPendingDelete] =
    useState<Program | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const activityCountsByProgramId = useMemo(
    () => groupActivityCountsByProgram(activityCounts),
    [activityCounts]
  );

  const refreshPrograms = useCallback(() => {
    startTransition(() => {
      listPrograms().then((loaded) => {
        setPrograms(loaded);
        setHasLoaded(true);
      });
    });
  }, []);

  useEffect(() => {
    refreshPrograms();
  }, [refreshPrograms]);
  // A program created from Claude shows up here at once (MCP bridge).
  useDataChanged("programs", refreshPrograms);

  useEffect(() => {
    listProgramActivityCounts().then(setActivityCounts);
  }, []);

  const handleCreateClick = useCallback(() => {
    setFormProgram(null);
    setIsFormOpen(true);
  }, []);

  // docs/specs/onboard-empty-states.md AC-1: open the form once, then drop
  // the flag from the URL so going back does not reopen it.
  useEffect(() => {
    if (search.new) {
      handleCreateClick();
      navigate({ replace: true, search: {}, to: "." });
    }
  }, [handleCreateClick, navigate, search.new]);

  const isEmpty = hasLoaded && programs.length === 0;

  const handleEdit = useCallback((program: Program) => {
    setFormProgram(program);
    setIsFormOpen(true);
  }, []);

  const handleRequestDelete = useCallback((program: Program) => {
    setProgramPendingDelete(program);
  }, []);

  const handleNavigateToModules = useCallback(
    (program: Program) => {
      navigate({
        params: { programId: program.id },
        to: "/programs/$programId",
      });
    },
    [navigate]
  );

  const handleFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open);
  }, []);

  const handleFormSubmit = useCallback(
    ({ color, icon, name }: ProgramFormSubmitValues) => {
      const submit = formProgram
        ? updateProgram(formProgram.id, name, { color, icon })
        : createProgram(name, { color, icon });

      submit.then(() => {
        setIsFormOpen(false);
        refreshPrograms();
      });
    },
    [formProgram, refreshPrograms]
  );

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setProgramPendingDelete(null);
    }
  }, []);

  // Brings back what was just deleted (docs/specs/safety-net.md AC-2).
  const undoDelete = useCallback(
    (id: string) => {
      restoreProgram(id).then(refreshPrograms);
    },
    [refreshPrograms]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!programPendingDelete) {
      return;
    }

    const deleted = programPendingDelete;
    softDeleteProgram(deleted.id).then(() => {
      setProgramPendingDelete(null);
      refreshPrograms();
      // docs/specs/safety-net.md AC-1
      showUndoToast({
        message: t("programDeletedMessage", { name: deleted.name }),
        onUndo: () => undoDelete(deleted.id),
        undoLabel: t("undoAction"),
      });
    });
  }, [programPendingDelete, refreshPrograms, t, undoDelete]);

  const handleImportClick = useCallback(() => setIsImportOpen(true), []);

  // Imported: open the program, with Undo (docs/specs/program-import.md §3 AC-3).
  const handleImported = useCallback(
    (report: ImportReport) => {
      setIsImportOpen(false);
      refreshPrograms();
      navigate({
        params: { programId: report.programId },
        to: "/programs/$programId",
      });
      showUndoToast({
        message: t("programImportedMessage", { name: report.programName }),
        onUndo: () => {
          undoProgramImport(report.created).then(refreshPrograms);
        },
        undoLabel: t("undoAction"),
      });
    },
    [navigate, refreshPrograms, t]
  );

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <h1 className="font-medium font-serif text-3xl tracking-[-0.02em]">
          {t("programsPageTitle")}
        </h1>
        {/* One create button per area (AC-6): the empty state has its own. */}
        {isEmpty ? null : (
          <div className="flex gap-2">
            <Button onClick={handleImportClick} variant="outline">
              {t("importProgramAction")}
            </Button>
            <Button onClick={handleCreateClick}>
              {t("createProgramAction")}
            </Button>
          </div>
        )}
      </div>
      {isEmpty ? (
        <ProgramsEmptyState
          onCreate={handleCreateClick}
          onImport={handleImportClick}
        />
      ) : (
        <ProgramsCardGrid
          activityCountsByProgramId={activityCountsByProgramId}
          dueCountByProgramId={dueCountByProgramId}
          onEdit={handleEdit}
          onNavigateToModules={handleNavigateToModules}
          onRequestDelete={handleRequestDelete}
          programs={programs}
        />
      )}
      <ProgramFormDialog
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
        program={formProgram}
      />
      <ProgramImportDialog
        onImported={handleImported}
        onOpenChange={setIsImportOpen}
        open={isImportOpen}
      />
      <DeleteProgramDialog
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        open={programPendingDelete !== null}
        program={programPendingDelete}
      />
    </div>
  );
}

export const Route = createFileRoute("/programs/")({
  component: ProgramsPage,
  validateSearch: validateProgramsSearch,
});
