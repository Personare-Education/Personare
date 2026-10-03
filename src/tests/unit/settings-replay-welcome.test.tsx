import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useSearch,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (docs/specs/replay-welcome.md AC-1, AC-2): Settings -> General
 * has "Show introduction", which closes Settings and opens Today's welcome.
 */

vi.mock("@/actions/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({ autoStart: false }),
  setAutoStart: vi.fn(),
}));
vi.mock("@/actions/dialog", () => ({ selectBackupImportFile: vi.fn() }));

const { default: SettingsDialog } = await import(
  "@/components/settings-dialog"
);

function SettingsHost() {
  const [open, setOpen] = useState(true);
  return <SettingsDialog onOpenChange={setOpen} open={open} />;
}

function TodayStub() {
  const search = useSearch({ strict: false }) as { welcome?: boolean };
  return <p>{search.welcome ? "today-welcome" : "today"}</p>;
}

function renderSettings() {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    component: TodayStub,
    getParentRoute: () => rootRoute,
    path: "/",
  });
  const settingsRoute = createRoute({
    component: SettingsHost,
    getParentRoute: () => rootRoute,
    path: "/programs",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/programs"] }),
    routeTree: rootRoute.addChildren([indexRoute, settingsRoute]),
  });
  render(<RouterProvider router={router} />);
}

describe("SettingsDialog: show the introduction again", () => {
  it("offers it in General, and opens Today's welcome", async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(
      await screen.findByText(i18n.t("replayWelcomeDescription"))
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: i18n.t("replayWelcomeAction") })
    );

    expect(await screen.findByText("today-welcome")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
