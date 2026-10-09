import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/** docs/specs/error-log.md AC-5: Settings has a Diagnostics category. */

vi.mock("@/actions/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({ autoStartEnabled: false }),
  setAutoStart: vi.fn(),
}));
vi.mock("@/actions/dialog", () => ({
  selectBackupImportFile: vi.fn(),
  selectErrorLogExportPath: vi.fn(),
}));
vi.mock("@/actions/error-log", () => ({ exportErrorLog: vi.fn() }));

const { default: SettingsDialog } = await import(
  "@/components/settings-dialog"
);

function renderSettings() {
  const rootRoute = createRootRoute({
    component: () => <SettingsDialog onOpenChange={vi.fn()} open />,
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute,
  });
  render(<RouterProvider router={router} />);
}

describe("SettingsDialog: Diagnostics", () => {
  it("shows the error log export", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("diagnosticsSectionTitle"),
      })
    );

    expect(
      screen.getByText(i18n.t("diagnosticsSectionDescription"))
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("exportErrorLogAction") })
    ).toBeInTheDocument();
  });
});
