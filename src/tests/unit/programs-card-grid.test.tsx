import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import ProgramsCardGrid, {
  type Program,
} from "@/components/programs-card-grid";
import { DEFAULT_PROGRAM_COLOR } from "@/constants/program-appearance";
import "@/localization/i18n";

/**
 * RED phase (Issue #99, Spec Driven TDD): src/components/programs-card-grid
 * does not exist yet -- it replaces src/components/programs-data-table.tsx,
 * per docs/specs/issue-99-programs-cards-heatmap.md AC-6. Every test below
 * is expected to fail until the Developer implements it.
 *
 * Contract:
 * - `programs` prop: one card per program, showing its name.
 * - Clicking a card calls `onNavigateToModules(program)` -- no separate
 *   "view modules" icon/button exists anymore.
 * - Right-clicking a card opens a shadcn Context Menu with "Editar"/"Excluir"
 *   (editProgramAction/deleteProgramAction) -- selecting one calls
 *   `onEdit(program)`/`onRequestDelete(program)` respectively.
 * - An empty `programs` list renders the (reused) `programsTableEmptyMessage`
 *   key.
 */

const PROGRAMS: Program[] = [
  {
    color: "#3b82f6",
    createdAt: new Date("2026-01-01"),
    icon: "Brain",
    id: "11111111-1111-1111-1111-111111111111",
    name: "Bacharelado II",
    updatedAt: new Date("2026-01-01"),
  },
  {
    color: null,
    createdAt: new Date("2026-02-01"),
    icon: null,
    id: "22222222-2222-2222-2222-222222222222",
    name: "Pos I",
    updatedAt: new Date("2026-02-01"),
  },
];

function renderGrid(
  programs: Program[] = PROGRAMS,
  dueCountByProgramId: Map<string, number> = new Map()
) {
  const onEdit = vi.fn();
  const onRequestDelete = vi.fn();
  const onNavigateToModules = vi.fn();

  render(
    <ProgramsCardGrid
      activityCountsByProgramId={new Map()}
      dueCountByProgramId={dueCountByProgramId}
      onEdit={onEdit}
      onNavigateToModules={onNavigateToModules}
      onRequestDelete={onRequestDelete}
      programs={programs}
    />
  );

  return { onEdit, onNavigateToModules, onRequestDelete };
}

describe("ProgramsCardGrid", () => {
  /** docs/specs/today-review-queue.md AC-10 */
  it("says how many reviews are due on a program's card, and nothing when none are", () => {
    renderGrid(PROGRAMS, new Map([[PROGRAMS[0].id, 4]]));

    expect(
      screen.getByText(i18n.t("programDueCount", { count: 4 }))
    ).toBeInTheDocument();
    expect(
      screen.queryAllByText(i18n.t("programDueCount", { count: 0 }))
    ).toHaveLength(0);
  });

  it("renders a card for each program with its name", () => {
    renderGrid();

    expect(screen.getByText("Bacharelado II")).toBeInTheDocument();
    expect(screen.getByText("Pos I")).toBeInTheDocument();
  });

  it("renders the empty-state message when there are no programs", () => {
    renderGrid([]);

    expect(
      screen.getByText(i18n.t("programsTableEmptyMessage"))
    ).toBeInTheDocument();
  });

  it("renders each program as a single clickable card, with no separate view-modules button", () => {
    renderGrid();

    expect(
      screen.getAllByRole("button", { name: new RegExp(PROGRAMS[0].name) })
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: i18n.t("viewModulesAction") })
    ).not.toBeInTheDocument();
  });

  it("calls onNavigateToModules with the corresponding program when its card is clicked", async () => {
    const user = userEvent.setup();
    const { onNavigateToModules } = renderGrid();

    await user.click(
      screen.getByRole("button", { name: new RegExp(PROGRAMS[1].name) })
    );

    expect(onNavigateToModules).toHaveBeenCalledTimes(1);
    expect(onNavigateToModules).toHaveBeenCalledWith(PROGRAMS[1]);
  });

  it("opens a context menu with edit and delete actions on right-click", async () => {
    renderGrid();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: new RegExp(PROGRAMS[0].name) })
    );

    expect(
      await screen.findByRole("menuitem", {
        name: i18n.t("editProgramAction"),
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: i18n.t("deleteProgramAction") })
    ).toBeInTheDocument();
  });

  it("calls onEdit with the corresponding program when the context menu's edit item is selected", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderGrid();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: new RegExp(PROGRAMS[1].name) })
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("editProgramAction"),
      })
    );

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(PROGRAMS[1]);
  });

  it("calls onRequestDelete with the corresponding program when the context menu's delete item is selected", async () => {
    const user = userEvent.setup();
    const { onRequestDelete } = renderGrid();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: new RegExp(PROGRAMS[0].name) })
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("deleteProgramAction"),
      })
    );

    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(onRequestDelete).toHaveBeenCalledWith(PROGRAMS[0]);
  });

  it("renders the card as cursor-pointer, since the whole card is clickable", () => {
    renderGrid();

    expect(
      screen.getByRole("button", { name: new RegExp(PROGRAMS[0].name) })
    ).toHaveClass("cursor-pointer");
  });

  it("applies the program's own color as the icon square's background", () => {
    renderGrid();

    const card = screen.getByRole("button", {
      name: new RegExp(PROGRAMS[0].name),
    });
    const iconSquare = card.querySelector("span");
    expect(iconSquare).toHaveStyle({ backgroundColor: "#3b82f6" });
  });

  it("falls back to the default color when the program has none", () => {
    renderGrid();

    const card = screen.getByRole("button", {
      name: new RegExp(PROGRAMS[1].name),
    });
    const iconSquare = card.querySelector("span");
    expect(iconSquare).toHaveStyle({ backgroundColor: DEFAULT_PROGRAM_COLOR });
  });

  it("opens a menu with edit and delete actions from the three-dot button, without triggering navigation", async () => {
    const user = userEvent.setup();
    const { onNavigateToModules } = renderGrid();

    const menuButtons = screen.getAllByRole("button", {
      name: i18n.t("programCardMenuAction"),
    });
    await user.click(menuButtons[0]);

    expect(
      await screen.findByRole("menuitem", {
        name: i18n.t("editProgramAction"),
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: i18n.t("deleteProgramAction") })
    ).toBeInTheDocument();
    expect(onNavigateToModules).not.toHaveBeenCalled();
  });

  it("calls onEdit when the three-dot menu's edit item is selected", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderGrid();

    const menuButtons = screen.getAllByRole("button", {
      name: i18n.t("programCardMenuAction"),
    });
    await user.click(menuButtons[1]);
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("editProgramAction"),
      })
    );

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(PROGRAMS[1]);
  });

  /**
   * RED phase (bug report): DropdownMenuContent/ContextMenuContent render
   * through a React portal (to document.body), but React bubbles synthetic
   * events through the *React tree*, not the DOM tree -- a click on
   * "Editar"/"Excluir" still bubbles up to the card's own onClick and fires
   * onNavigateToModules too, so selecting either action also navigates away.
   * Every action-selection test above only checked the intended callback
   * fired, never that navigation did NOT also fire.
   */
  it("does not also navigate when selecting the three-dot menu's edit item", async () => {
    const user = userEvent.setup();
    const { onNavigateToModules } = renderGrid();

    const menuButtons = screen.getAllByRole("button", {
      name: i18n.t("programCardMenuAction"),
    });
    await user.click(menuButtons[1]);
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("editProgramAction"),
      })
    );

    expect(onNavigateToModules).not.toHaveBeenCalled();
  });

  it("does not also navigate when selecting the three-dot menu's delete item", async () => {
    const user = userEvent.setup();
    const { onNavigateToModules } = renderGrid();

    const menuButtons = screen.getAllByRole("button", {
      name: i18n.t("programCardMenuAction"),
    });
    await user.click(menuButtons[0]);
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("deleteProgramAction"),
      })
    );

    expect(onNavigateToModules).not.toHaveBeenCalled();
  });

  it("does not also navigate when selecting the right-click context menu's edit item", async () => {
    const user = userEvent.setup();
    const { onNavigateToModules } = renderGrid();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: new RegExp(PROGRAMS[0].name) })
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("editProgramAction"),
      })
    );

    expect(onNavigateToModules).not.toHaveBeenCalled();
  });

  it("does not also navigate when selecting the right-click context menu's delete item", async () => {
    const user = userEvent.setup();
    const { onNavigateToModules } = renderGrid();

    fireEvent.contextMenu(
      screen.getByRole("button", { name: new RegExp(PROGRAMS[1].name) })
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("deleteProgramAction"),
      })
    );

    expect(onNavigateToModules).not.toHaveBeenCalled();
  });

  it("renders the activity heatmap for a program using its own slice of activityCountsByProgramId", () => {
    const activityCountsByProgramId = new Map([
      [PROGRAMS[0].id, [{ count: 4, date: "2026-03-10" }]],
    ]);

    render(
      <ProgramsCardGrid
        activityCountsByProgramId={activityCountsByProgramId}
        onEdit={vi.fn()}
        onNavigateToModules={vi.fn()}
        onRequestDelete={vi.fn()}
        programs={PROGRAMS}
      />
    );

    const heatmaps = screen.getAllByRole("img");
    expect(heatmaps).toHaveLength(PROGRAMS.length);
  });
});

describe("Programs screen i18n keys (Issue #99)", () => {
  const REQUIRED_KEYS = [
    "editProgramAction",
    "deleteProgramAction",
    "programsTableEmptyMessage",
    "programCardMenuAction",
  ];

  it.each(["en", "pt-BR"] as const)(
    "defines every ProgramsCardGrid key for the %s locale",
    (locale) => {
      const bundle = i18n.getResourceBundle(locale, "translation") ?? {};

      for (const key of REQUIRED_KEYS) {
        expect(bundle).toHaveProperty(key);
      }
    }
  );

  it.each(["en", "pt-BR"] as const)(
    "no longer defines the removed viewModulesAction key for the %s locale",
    (locale) => {
      const bundle = i18n.getResourceBundle(locale, "translation") ?? {};

      expect(bundle).not.toHaveProperty("viewModulesAction");
    }
  );
});
