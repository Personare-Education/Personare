import { ArrowDown, ArrowUp, ListChecks, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ActionableTableRow, {
  type RowAction,
} from "@/components/actionable-table-row";
import ReviewHighlightChip from "@/components/review-highlight-chip";
import ReviewHighlightTableFrame from "@/components/review-highlight-table-frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReviewHighlight } from "@/utils/review-highlight";

export interface Module {
  createdAt: Date;
  id: string;
  name: string;
  programId: string;
  updatedAt: Date;
}

interface ModulesDataTableProps {
  /** Pending-review highlight per module (docs/specs/calendar-module-review-highlight.md). */
  highlightByModuleId?: Record<string, ReviewHighlight | undefined>;
  modules: Module[];
  onEdit: (module: Module) => void;
  /** Moves a module up (-1) or down (1) (docs/specs/sequences-and-locks.md §3 AC-4). */
  onMove?: (module: Module, direction: -1 | 1) => void;
  onNavigateToActivities: (module: Module) => void;
  onRequestDelete: (module: Module) => void;
}

interface ModuleRowProps {
  highlight: ReviewHighlight | undefined;
  isFirst: boolean;
  isLast: boolean;
  module: Module;
  onEdit: (module: Module) => void;
  onMove?: (module: Module, direction: -1 | 1) => void;
  onNavigateToActivities: (module: Module) => void;
  onRequestDelete: (module: Module) => void;
}

function ModuleRow({
  highlight,
  isFirst,
  isLast,
  module,
  onEdit,
  onMove,
  onNavigateToActivities,
  onRequestDelete,
}: ModuleRowProps) {
  const { t } = useTranslation();

  // The first action is what clicking the row does.
  const actions = useMemo<RowAction[]>(() => {
    // Up and down, but not past the ends.
    const moveActions: RowAction[] = [];
    if (onMove && !isFirst) {
      moveActions.push({
        icon: <ArrowUp />,
        key: "move-up",
        label: t("moveUpAction"),
        onSelect: () => onMove(module, -1),
      });
    }
    if (onMove && !isLast) {
      moveActions.push({
        icon: <ArrowDown />,
        key: "move-down",
        label: t("moveDownAction"),
        onSelect: () => onMove(module, 1),
      });
    }
    return [
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
      ...moveActions,
      {
        destructive: true,
        icon: <Trash2 />,
        key: "delete",
        label: t("deleteModuleAction"),
        onSelect: () => onRequestDelete(module),
      },
    ];
  }, [
    isFirst,
    isLast,
    module,
    onEdit,
    onMove,
    onNavigateToActivities,
    onRequestDelete,
    t,
  ]);

  return (
    <ActionableTableRow
      actions={actions}
      highlight={highlight}
      onOpen={actions[0].onSelect}
      rowId={module.id}
    >
      <TableCell className="font-medium">
        <span className="flex items-center gap-2">
          {module.name}
          {/* Beside the name, not among the actions (docs/specs/layout-tables.md AC-3). */}
          {highlight ? <ReviewHighlightChip highlight={highlight} /> : null}
        </span>
      </TableCell>
    </ActionableTableRow>
  );
}

const NO_HIGHLIGHTS: Record<string, ReviewHighlight | undefined> = {};

export default function ModulesDataTable({
  highlightByModuleId = NO_HIGHLIGHTS,
  modules,
  onEdit,
  onMove,
  onNavigateToActivities,
  onRequestDelete,
}: ModulesDataTableProps) {
  const { t } = useTranslation();

  if (modules.length === 0) {
    return <p>{t("modulesTableEmptyMessage")}</p>;
  }

  return (
    <TooltipProvider>
      <ReviewHighlightTableFrame highlightById={highlightByModuleId}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("moduleNameLabel")}</TableHead>
              <TableHead>{t("actionsColumnLabel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((module, index) => (
              <ModuleRow
                highlight={highlightByModuleId[module.id]}
                isFirst={index === 0}
                isLast={index === modules.length - 1}
                key={module.id}
                module={module}
                onEdit={onEdit}
                onMove={onMove}
                onNavigateToActivities={onNavigateToActivities}
                onRequestDelete={onRequestDelete}
              />
            ))}
          </TableBody>
        </Table>
      </ReviewHighlightTableFrame>
    </TooltipProvider>
  );
}
