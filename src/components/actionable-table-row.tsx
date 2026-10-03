import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import ActionIconButton from "@/components/action-icon-button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
  /** Rendered as the row's buttons and, in the same order, its context menu. */
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

const HIGHLIGHT_LABEL_KEYS: Record<ReviewHighlight, string> = {
  focus: "reviewFocusLabel",
  overdue: "reviewOverdueLabel",
  today: "reviewDueTodayLabel",
};

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
              {/* Visible, not only for assistive tech
                  (docs/specs/today-review-queue.md AC-11). */}
              {highlight ? (
                <span
                  className={cn(
                    "mr-1 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-[0.6875rem]",
                    highlight === "overdue"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-brand/10 text-brand"
                  )}
                >
                  {t(HIGHLIGHT_LABEL_KEYS[highlight])}
                </span>
              ) : null}
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
