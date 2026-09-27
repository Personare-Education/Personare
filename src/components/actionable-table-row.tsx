import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
} from "react";
import ActionIconButton from "@/components/action-icon-button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TableCell, TableRow } from "@/components/ui/table";

export interface RowAction {
  destructive?: boolean;
  icon: ReactNode;
  key: string;
  label: string;
  onSelect: () => void;
}

interface ActionableTableRowProps {
  /** Rendered as the row's buttons and, in the same order, its context menu. */
  actions: RowAction[];
  /** Cells before the actions cell. */
  children: ReactNode;
  /** What clicking the row (or pressing Enter on it) does. */
  onOpen: () => void;
}

function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
}

/**
 * A table row that opens its item on click/Enter and lists its actions both
 * as icon buttons in the last cell and in a right-click context menu.
 */
export default function ActionableTableRow({
  actions,
  children,
  onOpen,
}: ActionableTableRowProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>) => {
      // Only the row itself: Enter on one of its buttons runs that button.
      if (event.key === "Enter" && event.target === event.currentTarget) {
        onOpen();
      }
    },
    [onOpen]
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          className="cursor-pointer"
          onClick={onOpen}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {children}
          {/* The buttons run their own action, not the row's. */}
          <TableCell onClick={stopPropagation}>
            <div className="flex items-center gap-1">
              {actions.map((action) => (
                <ActionIconButton
                  key={action.key}
                  label={action.label}
                  onClick={action.onSelect}
                >
                  {action.icon}
                </ActionIconButton>
              ))}
            </div>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {actions.map((action) => (
          <ContextMenuItem
            key={action.key}
            onClick={action.onSelect}
            variant={action.destructive ? "destructive" : "default"}
          >
            {action.icon}
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
