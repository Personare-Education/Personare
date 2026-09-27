import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import ActionIconButton from "@/components/action-icon-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface Module {
  createdAt: Date;
  id: string;
  name: string;
  programId: string;
  updatedAt: Date;
}

interface ModulesDataTableProps {
  modules: Module[];
  onEdit: (module: Module) => void;
  onNavigateToActivities: (module: Module) => void;
  onRequestDelete: (module: Module) => void;
}

interface ModuleRowProps {
  module: Module;
  onEdit: (module: Module) => void;
  onNavigateToActivities: (module: Module) => void;
  onRequestDelete: (module: Module) => void;
}

function ModuleRow({
  module,
  onEdit,
  onNavigateToActivities,
  onRequestDelete,
}: ModuleRowProps) {
  const { t } = useTranslation();

  const handleEditClick = useCallback(() => {
    onEdit(module);
  }, [onEdit, module]);

  const handleDeleteClick = useCallback(() => {
    onRequestDelete(module);
  }, [onRequestDelete, module]);

  const handleNavigateToActivitiesClick = useCallback(() => {
    onNavigateToActivities(module);
  }, [onNavigateToActivities, module]);

  return (
    <TableRow>
      <TableCell className="font-medium">{module.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <ActionIconButton
            label={t("viewActivitiesAction")}
            onClick={handleNavigateToActivitiesClick}
          >
            <ListChecks />
          </ActionIconButton>
          <ActionIconButton
            label={t("editModuleAction")}
            onClick={handleEditClick}
          >
            <Pencil />
          </ActionIconButton>
          <ActionIconButton
            label={t("deleteModuleAction")}
            onClick={handleDeleteClick}
          >
            <Trash2 />
          </ActionIconButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ModulesDataTable({
  modules,
  onEdit,
  onNavigateToActivities,
  onRequestDelete,
}: ModulesDataTableProps) {
  const { t } = useTranslation();

  if (modules.length === 0) {
    return <p>{t("modulesTableEmptyMessage")}</p>;
  }

  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("moduleNameLabel")}</TableHead>
              <TableHead>{t("actionsColumnLabel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((module) => (
              <ModuleRow
                key={module.id}
                module={module}
                onEdit={onEdit}
                onNavigateToActivities={onNavigateToActivities}
                onRequestDelete={onRequestDelete}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
