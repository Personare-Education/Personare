import { MoreHorizontal } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import ActionIconButton from "@/components/action-icon-button";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ReviewHighlight } from "@/utils/review-highlight";
import { cn } from "@/utils/tailwind";

export interface RowAction {
  destructive?: boolean;
  icon: ReactNode;
  key: string;
  label: string;
  onSelect: () => void;
}

interface ActionableTableRowProps {
  /**
   * The first is the row's main action, a labeled button; the rest go in
   * its "More actions" menu (docs/specs/row-primary-action.md). All of them,
   * in the same order, make its context menu.
   */
  actions: RowAction[];
  /** Cells before the actions cell. */
  children: ReactNode;
  /**
   * Pulses the row for a pending review (docs/specs/calendar-module-review-highlight.md);
   * an overdue one also needs `rowId`, for its clock beside the table
   * (ReviewHighlightTableFrame).
   */
  highlight?: ReviewHighlight;
  /** What clicking the row (or pressing Enter on it) does. */
  onOpen: () => void;
  rowId?: string;
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
  highlight,
  onOpen,
  rowId,
}: ActionableTableRowProps) {
  const { t } = useTranslation();
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>) => {
      // Only the row itself: Enter on one of its buttons runs that button.
      if (event.key === "Enter" && event.target === event.currentTarget) {
        onOpen();
      }
    },
    [onOpen]
  );
  const [primaryAction, ...menuActions] = actions;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          className={cn(
            "cursor-pointer",
            highlight && "review-pulse",
            highlight === "overdue" && "review-pulse-overdue"
          )}
          data-review-highlight={highlight}
          data-row-id={rowId}
          onClick={onOpen}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {children}
          {/* The buttons run their own action, not the row's. */}
          <TableCell onClick={stopPropagation}>
            <div className="flex items-center gap-1">
              {primaryAction ? (
                <Button
                  // Same name as its text, so it reads the same to everyone.
                  aria-label={primaryAction.label}
                  onClick={primaryAction.onSelect}
                  variant="outline"
                >
                  {primaryAction.icon}
                  {primaryAction.label}
                </Button>
              ) : null}
              {menuActions.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <ActionIconButton label={t("moreActionsAction")}>
                      <MoreHorizontal />
                    </ActionIconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {menuActions.map((action) => (
                      <DropdownMenuItem
                        key={action.key}
                        onClick={action.onSelect}
                        variant={action.destructive ? "destructive" : "default"}
                      >
                        {action.icon}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
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
