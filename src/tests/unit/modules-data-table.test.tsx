import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import ModulesDataTable, { type Module } from "@/components/modules-data-table";
import "@/localization/i18n";

const MODULE_1_ROW_NAME = /Modulo 1/;

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

  it("renders an edit, a delete and a view-activities action for every module", () => {
    renderTable();

    expect(
      screen.getAllByRole("button", { name: i18n.t("editModuleAction") })
    ).toHaveLength(MODULES.length);
    expect(
      screen.getAllByRole("button", { name: i18n.t("deleteModuleAction") })
    ).toHaveLength(MODULES.length);
    expect(
      screen.getAllByRole("button", { name: i18n.t("viewActivitiesAction") })
    ).toHaveLength(MODULES.length);
  });

  it("calls onEdit with the corresponding module when its edit action is triggered", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderTable();

    const editButtons = screen.getAllByRole("button", {
      name: i18n.t("editModuleAction"),
    });
    await user.click(editButtons[1]);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(MODULES[1]);
  });

  it("calls onRequestDelete with the corresponding module when its delete action is triggered", async () => {
    const user = userEvent.setup();
    const { onRequestDelete } = renderTable();

    const deleteButtons = screen.getAllByRole("button", {
      name: i18n.t("deleteModuleAction"),
    });
    await user.click(deleteButtons[0]);

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

    await user.click(
      screen.getAllByRole("button", { name: i18n.t("editModuleAction") })[0]
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
