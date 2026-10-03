import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ActivityHeatmap } from "@/components/activity-heatmap";
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
import {
  resolveProgramColor,
  resolveProgramIcon,
} from "@/constants/program-appearance";
import { programTintStyle } from "@/utils/program-tint";

export interface Program {
  color: string | null;
  createdAt: Date;
  icon: string | null;
  id: string;
  name: string;
  updatedAt: Date;
}

interface ProgramsCardGridProps {
  activityCountsByProgramId: Map<string, { count: number; date: string }[]>;
  /** Reviews due today per program (docs/specs/today-review-queue.md AC-10). */
  dueCountByProgramId?: Map<string, number>;
  onEdit: (program: Program) => void;
  onNavigateToModules: (program: Program) => void;
  onRequestDelete: (program: Program) => void;
  programs: Program[];
}

interface ProgramCardProps {
  activityCounts: { count: number; date: string }[];
  dueCount: number;
  onEdit: (program: Program) => void;
  onNavigateToModules: (program: Program) => void;
  onRequestDelete: (program: Program) => void;
  program: Program;
}

const ACTIVATE_KEYS = new Set(["Enter", " "]);

function ProgramCard({
  activityCounts,
  dueCount,
  onEdit,
  onNavigateToModules,
  onRequestDelete,
  program,
}: ProgramCardProps) {
  const { t } = useTranslation();
  const Icon = resolveProgramIcon(program.icon);
  const color = resolveProgramColor(program.color);

  const handleClick = useCallback(() => {
    onNavigateToModules(program);
  }, [onNavigateToModules, program]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!ACTIVATE_KEYS.has(event.key)) {
        return;
      }
      event.preventDefault();
      onNavigateToModules(program);
    },
    [onNavigateToModules, program]
  );

  const handleEditClick = useCallback(
    (event: MouseEvent) => {
      // DropdownMenuContent (unlike ContextMenuContent, which already stops
      // this itself) renders through a React portal to document.body -- React
      // bubbles synthetic events through the *React tree*, not the DOM tree,
      // so without this the click still reaches the card's own onClick below
      // and navigates to the modules instead of/alongside editing.
      event.stopPropagation();
      onEdit(program);
    },
    [onEdit, program]
  );

  const handleDeleteClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onRequestDelete(program);
    },
    [onRequestDelete, program]
  );

  const handleMenuTriggerClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    []
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* biome-ignore lint/a11y/useSemanticElements: must not be a real <button> -- it wraps the three-dot menu's own <button>, and a button can't contain another button. */}
        <div
          aria-label={program.name}
          className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          style={programTintStyle(color, { fadeAt: "70%" })}
          tabIndex={0}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: color }}
              >
                <Icon className="size-5 text-white" />
              </span>
              <span className="flex min-w-0 flex-col items-start gap-1">
                <span className="max-w-full truncate font-medium text-sm">
                  {program.name}
                </span>
                {dueCount > 0 ? (
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-medium text-[0.6875rem] tabular-nums">
                    {t("programDueCount", { count: dueCount })}
                  </span>
                ) : null}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={t("programCardMenuAction")}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  onClick={handleMenuTriggerClick}
                  type="button"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEditClick}>
                  <Pencil />
                  {t("editProgramAction")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDeleteClick}
                  variant="destructive"
                >
                  <Trash2 />
                  {t("deleteProgramAction")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ActivityHeatmap color={color} counts={activityCounts} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEditClick}>
          <Pencil />
          {t("editProgramAction")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDeleteClick} variant="destructive">
          <Trash2 />
          {t("deleteProgramAction")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function ProgramsCardGrid({
  activityCountsByProgramId,
  dueCountByProgramId,
  onEdit,
  onNavigateToModules,
  onRequestDelete,
  programs,
}: ProgramsCardGridProps) {
  const { t } = useTranslation();

  if (programs.length === 0) {
    return <p>{t("programsTableEmptyMessage")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {programs.map((program) => (
        <ProgramCard
          activityCounts={activityCountsByProgramId.get(program.id) ?? []}
          dueCount={dueCountByProgramId?.get(program.id) ?? 0}
          key={program.id}
          onEdit={onEdit}
          onNavigateToModules={onNavigateToModules}
          onRequestDelete={onRequestDelete}
          program={program}
        />
      ))}
    </div>
  );
}
