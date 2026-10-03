import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  softDeleteProgram,
  updateProgram,
} from "@/actions/programs";
import DeleteProgramDialog from "@/components/delete-program-dialog";
import ProgramFormDialog, {
  type ProgramFormSubmitValues,
} from "@/components/program-form-dialog";
import ProgramsCardGrid, {
  type Program,
} from "@/components/programs-card-grid";
import { Button } from "@/components/ui/button";
import { useDueReviews } from "@/hooks/use-due-count";

function ProgramsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activityCounts, setActivityCounts] = useState<ProgramActivityCount[]>(
    []
  );
  const [, startTransition] = useTransition();
  const { byProgram: dueCountByProgramId } = useDueReviews();
  const [formProgram, setFormProgram] = useState<Program | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [programPendingDelete, setProgramPendingDelete] =
    useState<Program | null>(null);

  const activityCountsByProgramId = useMemo(
    () => groupActivityCountsByProgram(activityCounts),
    [activityCounts]
  );

  const refreshPrograms = useCallback(() => {
    startTransition(() => {
      listPrograms().then(setPrograms);
    });
  }, []);

  useEffect(() => {
    refreshPrograms();
  }, [refreshPrograms]);

  useEffect(() => {
    listProgramActivityCounts().then(setActivityCounts);
  }, []);

  const handleCreateClick = useCallback(() => {
    setFormProgram(null);
    setIsFormOpen(true);
  }, []);

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

  const handleConfirmDelete = useCallback(() => {
    if (!programPendingDelete) {
      return;
    }

    softDeleteProgram(programPendingDelete.id).then(() => {
      setProgramPendingDelete(null);
      refreshPrograms();
    });
  }, [programPendingDelete, refreshPrograms]);

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <h1 className="font-medium font-serif text-3xl tracking-[-0.02em]">
          {t("programsPageTitle")}
        </h1>
        <Button onClick={handleCreateClick}>{t("createProgramAction")}</Button>
      </div>
      <ProgramsCardGrid
        activityCountsByProgramId={activityCountsByProgramId}
        dueCountByProgramId={dueCountByProgramId}
        onEdit={handleEdit}
        onNavigateToModules={handleNavigateToModules}
        onRequestDelete={handleRequestDelete}
        programs={programs}
      />
      <ProgramFormDialog
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
        program={formProgram}
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
});
