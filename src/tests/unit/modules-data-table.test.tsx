import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import ModulesDataTable, { type Module } from "@/components/modules-data-table";
import "@/localization/i18n";

const MODULE_1_ROW_NAME = /Modulo 1/;
const MODULE_2_ROW_NAME = /Modulo 2/;
const MODULE_3_ROW_NAME = /Modulo 3/;

/**
 * RED phase (Issue #9, Spec Driven TDD): src/components/modules-data-table
 * does not exist yet. Every test below is expected to fail until Estaleiro
 * (Developer) implements it, mirroring src/components/programs-data-table
 * (Issue #8).
 *
 * Contract exercised here (criterio de aceite 8: "renderizacao da Data
 * Table de Modulos"):
 * - `modules` prop: rows rendered, one per module, showing its name.
 * - `onEdit(module)`: called when a row's edit action is triggered
 *   (criterio 3).
 * - `onRequestDelete(module)`: called when a row's delete action is
 *   triggered (naming signals it only *requests* the deletion -- the
 *   actual soft-delete confirmation/AlertDialog, per criterio 4, is the
 *   caller's responsibility, not the table's).
 * - `onNavigateToActivities(module)`: called when a row's "view
 *   activities" action is triggered (criterio 5).
 * - Action labels come from i18next keys `editModuleAction`,
 *   `deleteModuleAction` and `viewActivitiesAction` (criterio 6: no
 *   hardcoded UI text) -- read through `i18n.t` so this test does not
 *   hardcode copy, only the key names Estaleiro must add translations for.
 * - An empty `modules` list renders the `modulesTableEmptyMessage` key.
 */

const MODULES: Module[] = [
  {
    createdAt: new Date("2026-01-01"),
    id: "11111111-1111-1111-1111-111111111111",
    name: "Modulo 1",
    programId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    updatedAt: new Date("2026-01-01"),
  },
  {
    createdAt: new Date("2026-02-01"),
    id: "22222222-2222-2222-2222-222222222222",
    name: "Modulo 2",
    programId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    updatedAt: new Date("2026-02-01"),
  },
];

function renderTable(modules: Module[] = MODULES) {
  const onEdit = vi.fn();
  const onRequestDelete = vi.fn();
  const onNavigateToActivities = vi.fn();

  render(
    <ModulesDataTable
      modules={modules}
      onEdit={onEdit}
      onNavigateToActivities={onNavigateToActivities}
      onRequestDelete={onRequestDelete}
    />
  );

  return { onEdit, onNavigateToActivities, onRequestDelete };
}

describe("ModulesDataTable", () => {
  it("renders a row for each module with its name", () => {
    renderTable();

    expect(screen.getByText("Modulo 1")).toBeInTheDocument();
    expect(screen.getByText("Modulo 2")).toBeInTheDocument();
  });

  it("renders the empty-state message when there are no modules", () => {
    renderTable([]);

    expect(
      screen.getByText(i18n.t("modulesTableEmptyMessage"))
    ).toBeInTheDocument();
  });

  /** docs/specs/layout-tables.md AC-4 */
  it("shows view activities on every row and keeps edit and delete in 'More actions'", () => {
    renderTable();

    expect(
      screen.getAllByRole("button", { name: i18n.t("viewActivitiesAction") })
    ).toHaveLength(MODULES.length);
    expect(
      screen.getAllByRole("button", { name: i18n.t("moreActionsAction") })
    ).toHaveLength(MODULES.length);
    expect(
      screen.queryByRole("button", { name: i18n.t("editModuleAction") })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: i18n.t("deleteModuleAction") })
    ).toBeNull();
  });

  it("calls onEdit with the corresponding module when its edit action is triggered", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderTable();

    await user.click(
      screen.getAllByRole("button", { name: i18n.t("moreActionsAction") })[1]
    );
    await user.click(
      await screen.findByRole("menuitem", { name: i18n.t("editModuleAction") })
    );

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(MODULES[1]);
  });

  it("calls onRequestDelete with the corresponding module when its delete action is triggered", async () => {
    const user = userEvent.setup();
    const { onRequestDelete } = renderTable();

    await user.click(
      screen.getAllByRole("button", { name: i18n.t("moreActionsAction") })[0]
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("deleteModuleAction"),
      })
    );

    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(onRequestDelete).toHaveBeenCalledWith(MODULES[0]);
  });

  it("calls onNavigateToActivities with the corresponding module when its view-activities action is triggered", async () => {
    const user = userEvent.setup();
    const { onNavigateToActivities } = renderTable();

    const viewActivitiesButtons = screen.getAllByRole("button", {
      name: i18n.t("viewActivitiesAction"),
    });
    await user.click(viewActivitiesButtons[0]);

    expect(onNavigateToActivities).toHaveBeenCalledTimes(1);
    expect(onNavigateToActivities).toHaveBeenCalledWith(MODULES[0]);
  });
});

describe("ModulesDataTable row click and context menu", () => {
  it("opens the module's activities when its row is clicked", async () => {
    const user = userEvent.setup();
    const { onNavigateToActivities } = renderTable();

    await user.click(screen.getByText("Modulo 2"));

    expect(onNavigateToActivities).toHaveBeenCalledTimes(1);
    expect(onNavigateToActivities).toHaveBeenCalledWith(MODULES[1]);
  });

  it("opens the module's activities when its row is focused and Enter is pressed", async () => {
    const user = userEvent.setup();
    const { onNavigateToActivities } = renderTable();

    screen.getByRole("row", { name: MODULE_1_ROW_NAME }).focus();
    await user.keyboard("{Enter}");

    expect(onNavigateToActivities).toHaveBeenCalledWith(MODULES[0]);
  });

  it("does not also open the module when one of its action buttons is clicked", async () => {
    const user = userEvent.setup();
    const { onEdit, onNavigateToActivities } = renderTable();

    // Neither the "More actions" button nor its menu item opens the row.
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("moreActionsAction") })[0]
    );
    await user.click(
      await screen.findByRole("menuitem", { name: i18n.t("editModuleAction") })
    );

    expect(onEdit).toHaveBeenCalledWith(MODULES[0]);
    expect(onNavigateToActivities).not.toHaveBeenCalled();
  });

  it("lists every module action in a context menu on right-click", async () => {
    renderTable();

    fireEvent.contextMenu(screen.getByText("Modulo 1"));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      i18n.t("viewActivitiesAction"),
      i18n.t("editModuleAction"),
      i18n.t("deleteModuleAction"),
    ]);
  });

  it("runs the selected context menu action for that module", async () => {
    const user = userEvent.setup();
    const { onRequestDelete } = renderTable();

    fireEvent.contextMenu(screen.getByText("Modulo 2"));
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("deleteModuleAction"),
      })
    );

    expect(onRequestDelete).toHaveBeenCalledWith(MODULES[1]);
  });
});

describe("Modules screen i18n keys (Issue #9)", () => {
  const REQUIRED_KEYS = [
    "editModuleAction",
    "deleteModuleAction",
    "viewActivitiesAction",
    "modulesTableEmptyMessage",
    "createModuleAction",
    "createModuleTitle",
    "editModuleTitle",
    "moduleNameLabel",
    "deleteModuleConfirmTitle",
    "deleteModuleConfirmDescription",
  ];

  it.each(["en", "pt-BR"] as const)(
    "defines every ModulesDataTable key for the %s locale",
    (locale) => {
      const bundle = i18n.getResourceBundle(locale, "translation") ?? {};

      for (const key of REQUIRED_KEYS) {
        expect(bundle).toHaveProperty(key);
      }
    }
  );
});

/**
 * docs/specs/calendar-module-review-highlight.md AC-4 to AC-6: a row pulses
 * while it has a review due today (or is in focus from the calendar), and
 * pulses red with a clock beside the table while a review is overdue.
 */
describe("ModulesDataTable review highlight", () => {
  function renderHighlighted() {
    render(
      <ModulesDataTable
        highlightByModuleId={{
          [MODULES[0].id]: "overdue",
          [MODULES[1].id]: "today",
        }}
        modules={[
          ...MODULES,
          {
            ...MODULES[1],
            id: "33333333-3333-3333-3333-333333333333",
            name: "Modulo 3",
          },
        ]}
        onEdit={vi.fn()}
        onNavigateToActivities={vi.fn()}
        onRequestDelete={vi.fn()}
      />
    );
  }

  it("marks a row due today and says so to assistive tech", () => {
    renderHighlighted();
    const row = screen.getByRole("row", { name: MODULE_2_ROW_NAME });

    expect(row).toHaveAttribute("data-review-highlight", "today");
    expect(row).toHaveTextContent(i18n.t("reviewDueTodayLabel"));
  });

  /**
   * docs/specs/today-review-queue.md AC-11: the label is a visible chip, not
   * only text for assistive tech.
   */
  it("shows the review label as a visible chip", () => {
    renderHighlighted();
    const row = screen.getByRole("row", { name: MODULE_2_ROW_NAME });

    const label = Array.from(row.querySelectorAll("span")).find(
      (span) => span.textContent === i18n.t("reviewDueTodayLabel")
    );
    expect(label).toBeDefined();
    expect(label).not.toHaveClass("sr-only");
  });

  it("marks an overdue row and puts one clock beside the table, not inside it", () => {
    renderHighlighted();
    const row = screen.getByRole("row", { name: MODULE_1_ROW_NAME });

    expect(row).toHaveAttribute("data-review-highlight", "overdue");
    expect(row).toHaveTextContent(i18n.t("reviewOverdueLabel"));
    const markers = document.querySelectorAll(
      '[data-slot="overdue-review-marker"]'
    );
    expect(markers).toHaveLength(1);
    expect(markers[0].closest("table")).toBeNull();
  });

  it("leaves a row without pending reviews alone", () => {
    renderHighlighted();
    const row = screen.getByRole("row", { name: MODULE_3_ROW_NAME });

    expect(row).not.toHaveAttribute("data-review-highlight");
  });
});

/** docs/specs/sequences-and-locks.md §3 AC-4 */
describe("ModulesDataTable order", () => {
  it("moves a module up, and the last one cannot go down", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(
      <ModulesDataTable
        modules={MODULES}
        onEdit={vi.fn()}
        onMove={onMove}
        onNavigateToActivities={vi.fn()}
        onRequestDelete={vi.fn()}
      />
    );
    const row = screen.getByText(MODULES[1].name).closest("tr") as HTMLElement;

    await user.click(
      within(row).getByRole("button", { name: i18n.t("moreActionsAction") })
    );
    expect(
      screen.queryByRole("menuitem", { name: i18n.t("moveDownAction") })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("menuitem", { name: i18n.t("moveUpAction") })
    );

    expect(onMove).toHaveBeenCalledWith(MODULES[1], -1);
  });
});

/** docs/specs/sequences-and-locks.md §4 AC-1, AC-2 */
describe("ModulesDataTable locks", () => {
  it("shows a locked module's padlock, and opens its rule", async () => {
    const user = userEvent.setup();
    const onUnlockRule = vi.fn();
    render(
      <ModulesDataTable
        lockLabelById={{ [MODULES[1].id]: "Unlocks after Modulo 1" }}
        modules={MODULES}
        onEdit={vi.fn()}
        onNavigateToActivities={vi.fn()}
        onRequestDelete={vi.fn()}
        onUnlockRule={onUnlockRule}
      />
    );

    expect(screen.getByText("Unlocks after Modulo 1")).toBeInTheDocument();
    const row = screen.getByText(MODULES[1].name).closest("tr") as HTMLElement;
    await user.click(
      within(row).getByRole("button", { name: i18n.t("moreActionsAction") })
    );
    await user.click(
      screen.getByRole("menuitem", { name: i18n.t("unlockRuleAction") })
    );

    expect(onUnlockRule).toHaveBeenCalledWith(MODULES[1]);
  });
});
