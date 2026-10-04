import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AppSidebar from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import "@/localization/i18n";

// The Today item's count comes from the review schedule
// (docs/specs/today-review-queue.md AC-1).
vi.mock("@/actions/calendar", () => ({
  ensureReviewItems: vi.fn().mockResolvedValue(undefined),
  listSchedule: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/actions/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({ autoStart: false }),
  setAutoStart: vi.fn(),
}));
const { listSchedule } = await import("@/actions/calendar");

beforeEach(() => {
  vi.mocked(listSchedule).mockResolvedValue([]);
});

/*
 * Spec: Issue #17 - Sidebar de navegacao.
 * Criterio 2: itens "Programas" (-> "/") e "Calendario" (-> rota de calendario,
 * aceita "/calendario" ou "/calendar" como placeholder, ver spec).
 * Criterio 3: rotulos vem de i18next (chaves navPrograms/navCalendar em
 * src/localization/i18n.ts), nao sao texto hardcoded.
 * Criterio 4: item da rota ativa tem indicador visual - TanStack Router marca
 * o Link ativo com aria-current="page" automaticamente.
 */

function renderSidebarAt(initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
  });
  const programsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/programs",
  });
  const programRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/programs/$programId",
  });
  const calendarioRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/calendario",
  });
  const calendarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/calendar",
  });
  const routeTree = rootRoute.addChildren([
    indexRoute,
    programsRoute,
    programRoute,
    calendarioRoute,
    calendarRoute,
  ]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    routeTree,
  });

  return render(<RouterProvider router={router} />);
}

afterEach(async () => {
  await i18n.changeLanguage("en");
});

test("i18n has translated labels for the Programs and Calendar nav items in en and pt-BR", () => {
  const en = i18n.getResourceBundle("en", "translation");
  const ptBR = i18n.getResourceBundle("pt-BR", "translation");

  expect(en.navPrograms).toBeTruthy();
  expect(en.navCalendar).toBeTruthy();
  expect(ptBR.navPrograms).toBeTruthy();
  expect(ptBR.navCalendar).toBeTruthy();
});

test("renders a Today item first, linking to '/'", async () => {
  renderSidebarAt("/");

  const todayLink = await screen.findByRole("link", {
    name: new RegExp(i18n.t("navToday")),
  });
  const links = screen.getAllByRole("link");

  expect(todayLink).toHaveAttribute("href", "/");
  expect(links.indexOf(todayLink)).toBeLessThan(
    links.indexOf(screen.getByRole("link", { name: i18n.t("navPrograms") }))
  );
});

test("shows how many reviews are due today on the Today item", async () => {
  const now = new Date();
  vi.mocked(listSchedule).mockResolvedValue(
    ["1", "2", "3"].map((id) => ({
      activityFilePath: null,
      activityId: `a${id}`,
      activityTitle: "A",
      activityType: "pdf",
      activityUrl: null,
      dueDate: now,
      front: null,
      id,
      moduleId: "m",
      moduleName: "M",
      programColor: null,
      programId: "p",
      programName: "P",
    }))
  );
  renderSidebarAt("/");

  const todayLink = await screen.findByRole("link", {
    name: new RegExp(i18n.t("navToday")),
  });

  expect(await screen.findByText("3")).toBeInTheDocument();
  expect(todayLink).toHaveTextContent("3");
});

test("renders a Programas item linking to '/programs'", async () => {
  renderSidebarAt("/");

  const programsLink = await screen.findByRole("link", {
    name: i18n.t("navPrograms"),
  });

  expect(programsLink).toHaveAttribute("href", "/programs");
});

test("renders a Calendario item linking to a calendar route", async () => {
  renderSidebarAt("/");

  const calendarLink = await screen.findByRole("link", {
    name: i18n.t("navCalendar"),
  });
  const href = calendarLink.getAttribute("href");

  expect(href).toBeTruthy();
  expect(href).not.toBe("/");
  expect(href?.toLowerCase()).toContain("calend");
});

test("nav labels come from i18next and switch with the active language", async () => {
  await i18n.changeLanguage("pt-BR");
  renderSidebarAt("/");

  expect(
    await screen.findByRole("link", { name: i18n.t("navPrograms") })
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("link", { name: i18n.t("navCalendar") })
  ).toBeInTheDocument();
});

test("active route indicator moves with the current location", async () => {
  renderSidebarAt("/");

  const homeLinkAtRoot = await screen.findByRole("link", {
    name: new RegExp(i18n.t("navToday")),
  });
  const calendarLinkAtRoot = await screen.findByRole("link", {
    name: i18n.t("navCalendar"),
  });
  const calendarHref = calendarLinkAtRoot.getAttribute("href") as string;

  expect(homeLinkAtRoot).toHaveAttribute("aria-current", "page");
  expect(calendarLinkAtRoot).not.toHaveAttribute("aria-current");

  cleanup();
  renderSidebarAt(calendarHref);

  const homeLinkAtCalendar = await screen.findByRole("link", {
    name: new RegExp(i18n.t("navToday")),
  });
  const calendarLinkAtCalendar = await screen.findByRole("link", {
    name: i18n.t("navCalendar"),
  });

  expect(calendarLinkAtCalendar).toHaveAttribute("aria-current", "page");
  expect(homeLinkAtCalendar).not.toHaveAttribute("aria-current");
});

/** docs/specs/settings-in-sidebar.md AC-1, AC-2 */
test("opens Settings from the sidebar, not only from the account menu", async () => {
  const user = userEvent.setup();
  renderSidebarAt("/");

  await user.click(
    await screen.findByRole("button", { name: i18n.t("settingsPageTitle") })
  );

  expect(
    await screen.findByRole("dialog", { name: i18n.t("settingsPageTitle") })
  ).toBeInTheDocument();
});

/** docs/specs/sidebar-current-page.md AC-1, AC-2 */
test.each([
  ["/", "navToday"],
  ["/programs", "navPrograms"],
  ["/programs/p1", "navPrograms"],
  ["/calendar", "navCalendar"],
])("marks only the current page's item at %s", async (path, key) => {
  renderSidebarAt(path);

  const current = await screen.findByRole("link", { name: i18n.t(key) });
  await waitFor(() => expect(current).toHaveAttribute("data-active", "true"));
  const others = ["navToday", "navPrograms", "navCalendar"].filter(
    (other) => other !== key
  );
  for (const other of others) {
    expect(
      screen.getByRole("link", { name: i18n.t(other) })
    ).not.toHaveAttribute("data-active", "true");
  }
});
