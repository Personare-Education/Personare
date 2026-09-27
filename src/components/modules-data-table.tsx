import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ActionableTableRow, {
  type RowAction,
} from "@/components/actionable-table-row";
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

  // The first action is what clicking the row does.
  const actions = useMemo<RowAction[]>(
    () => [
      {
        icon: <ListChecks />,
        key: "view-activities",
        label: t("viewActivitiesAction"),
        onSelect: () => onNavigateToActivities(module),
      },
      {
        icon: <Pencil />,
        key: "edit",
        label: t("editModuleAction"),
        onSelect: () => onEdit(module),
      },
      {
        destructive: true,
        icon: <Trash2 />,
        key: "delete",
        label: t("deleteModuleAction"),
        onSelect: () => onRequestDelete(module),
      },
    ],
    [module, onEdit, onNavigateToActivities, onRequestDelete, t]
  );

  return (
    <ActionableTableRow actions={actions} onOpen={actions[0].onSelect}>
      <TableCell className="font-medium">{module.name}</TableCell>
    </ActionableTableRow>
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
