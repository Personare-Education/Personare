import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { ScheduleRow } from "@/actions/calendar";

/**
 * RED phase (docs/specs/today-review-queue.md AC-1..4, AC-8): the "Today"
 * screen -- how many reviews are due, the list grouped by program, "Start"
 * for the whole day or a click for one item, and the end-of-day view.
 */

vi.mock("@/actions/calendar", () => ({
  ensureReviewItems: vi.fn().mockResolvedValue(undefined),
  listSchedule: vi.fn(),
}));
vi.mock("@/actions/streak", () => ({
  listActivityCounts: vi.fn(),
}));
vi.mock("@/actions/programs", () => ({
  listPrograms: vi.fn(),
}));
vi.mock("@/actions/review", () => ({
  ensureReviewItems: vi.fn().mockResolvedValue(undefined),
  listDue: vi.fn().mockResolvedValue([]),
  markActivityDifficulty: vi.fn().mockResolvedValue({}),
  previewActivityRatings: vi.fn().mockResolvedValue({}),
  previewItemRatings: vi.fn().mockResolvedValue({}),
  submitRating: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/actions/shell", () => ({
  openActivityFile: vi.fn().mockResolvedValue({ errorMessage: "" }),
  openExternalLink: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/actions/attachments", () => ({
  getAttachmentImageDataUrl: vi.fn(),
}));
vi.mock("@/components/quiz-runner-dialog", () => ({ default: () => null }));

const { listSchedule } = await import("@/actions/calendar");
const { listActivityCounts } = await import("@/actions/streak");
const { listPrograms } = await import("@/actions/programs");
const { TodayPage } = await import("@/routes/index");

const SKULL_ITEM = /Ossos do crânio/;
const NOW = new Date();
const YESTERDAY = new Date(NOW.getTime() - 26 * 60 * 60 * 1000);
const NEXT_WEEK = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);

function row(overrides: Partial<ScheduleRow>): ScheduleRow {
  return {
    activityFilePath: "C:/a.pdf",
    activityId: "a1",
    activityTitle: "Capítulo 3",
    activityType: "pdf",
    activityUrl: null,
    dueDate: NOW,
    front: null,
    id: "r1",
    moduleId: "m1",
    moduleName: "Derivadas",
    programColor: "#3b82f6",
    programId: "p1",
    programName: "Cálculo I",
    ...overrides,
  };
}

const DUE_ROWS = [
  row({ activityId: "a1", activityTitle: "Capítulo 3", id: "1" }),
  row({
    activityId: "a2",
    activityTitle: "Aula gravada",
    activityType: "link",
    activityUrl: "https://example.com",
    dueDate: YESTERDAY,
    id: "2",
  }),
  row({
    activityId: "a3",
    activityTitle: "Ossos do crânio",
    id: "3",
    moduleName: "Esqueleto",
    programColor: "#ec4899",
    programId: "p2",
    programName: "Anatomia",
  }),
];

function renderPage(initialPath = "/") {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    component: TodayPage,
    getParentRoute: () => rootRoute,
    path: "/",
  });
  const programsRoute = createRoute({
    component: () => <p>programs-page</p>,
    getParentRoute: () => rootRoute,
    path: "/programs",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    routeTree: rootRoute.addChildren([indexRoute, programsRoute]),
  });
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listActivityCounts).mockResolvedValue([]);
  vi.mocked(listPrograms).mockResolvedValue([
    {
      color: "#3b82f6",
      createdAt: NOW,
      icon: null,
      id: "p1",
      name: "Cálculo I",
      updatedAt: NOW,
    },
    {
      color: "#ec4899",
      createdAt: NOW,
      icon: null,
      id: "p2",
      name: "Anatomia",
      updatedAt: NOW,
    },
  ] as never);
});

describe("TodayPage", () => {
  it("says how many reviews are due today, and how many are overdue", async () => {
    vi.mocked(listSchedule).mockResolvedValue(DUE_ROWS);
    renderPage();

    expect(
      await screen.findByText(i18n.t("todayDueSummary", { count: 3 }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("todayOverdueSummary", { count: 1 }))
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("todayStartAction") })
    ).toBeInTheDocument();
  });

  /** docs/specs/clarify-daily-count.md AC-1 */
  it("counts a deck once, with its due cards as a detail", async () => {
    vi.mocked(listSchedule).mockResolvedValue([
      row({ activityId: "deck", activityType: "flashcard_deck", id: "c1" }),
      row({ activityId: "deck", activityType: "flashcard_deck", id: "c2" }),
      row({ activityId: "pdf", id: "p1" }),
    ]);
    renderPage();

    expect(
      await screen.findByText(i18n.t("todayDueSummary", { count: 2 }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("todayDueCardsDetail", { count: 2 }))
    ).toBeInTheDocument();
  });

  it("lists the due items grouped by program, overdue first", async () => {
    vi.mocked(listSchedule).mockResolvedValue(DUE_ROWS);
    renderPage();

    const calculus = await screen.findByRole("region", { name: "Cálculo I" });
    const titles = within(calculus)
      .getAllByRole("button")
      .map((button) => button.textContent ?? "");
    expect(titles[0]).toContain("Aula gravada");
    expect(titles[1]).toContain("Capítulo 3");
    expect(
      within(screen.getByRole("region", { name: "Anatomia" })).getByText(
        "Ossos do crânio"
      )
    ).toBeInTheDocument();
  });

  it("starts a session over the whole day", async () => {
    const user = userEvent.setup();
    vi.mocked(listSchedule).mockResolvedValue(DUE_ROWS);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: i18n.t("todayStartAction") })
    );

    const session = await screen.findByRole("dialog");
    expect(
      within(session).getByText(
        i18n.t("todaySessionProgress", { current: 1, total: 3 })
      )
    ).toBeInTheDocument();
    expect(within(session).getByText("Aula gravada")).toBeInTheDocument();
  });

  it("starts a session over just the clicked item", async () => {
    const user = userEvent.setup();
    vi.mocked(listSchedule).mockResolvedValue(DUE_ROWS);
    renderPage();

    await user.click(await screen.findByRole("button", { name: SKULL_ITEM }));

    const session = await screen.findByRole("dialog");
    expect(
      within(session).getByText(
        i18n.t("todaySessionProgress", { current: 1, total: 1 })
      )
    ).toBeInTheDocument();
  });

  it("shows the free day with the next review date when nothing is due", async () => {
    vi.mocked(listSchedule).mockResolvedValue([
      row({ dueDate: NEXT_WEEK, id: "future" }),
    ]);
    renderPage();

    expect(
      await screen.findByText(i18n.t("todayFreeDayTitle"))
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t("todayUpcomingTitle"))).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("todayStartAction") })
    ).not.toBeInTheDocument();
  });

  it("closes the day with what was reviewed and the streak", async () => {
    vi.mocked(listSchedule).mockResolvedValue([]);
    const todayKey = [
      NOW.getFullYear(),
      String(NOW.getMonth() + 1).padStart(2, "0"),
      String(NOW.getDate()).padStart(2, "0"),
    ].join("-");
    vi.mocked(listActivityCounts).mockResolvedValue([
      // Four ratings on two activities (docs/specs/clarify-daily-count.md AC-4).
      { activities: 2, count: 4, date: todayKey, programId: "p1" },
    ]);
    renderPage();

    expect(
      await screen.findByText(i18n.t("todayDayDoneTitle"))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("todayReviewedToday", { count: 2 }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("todayStreak", { count: 1 }))
    ).toBeInTheDocument();
  });

  it("says when today's reviews could not be loaded, and retries", async () => {
    const user = userEvent.setup();
    vi.mocked(listSchedule)
      .mockRejectedValueOnce(new Error("ipc"))
      .mockResolvedValue(DUE_ROWS);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: i18n.t("todayRetryAction") })
    );

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t("todayDueSummary", { count: 3 }))
      ).toBeInTheDocument();
    });
  });

  /** docs/specs/onboard-empty-states.md AC-1 */
  it("welcomes a first run with the study loop and a way to start", async () => {
    const user = userEvent.setup();
    vi.mocked(listPrograms).mockResolvedValue([]);
    vi.mocked(listSchedule).mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: i18n.t("todayWelcomeTitle") })
    ).toBeInTheDocument();
    const steps = screen.getByRole("list", {
      name: i18n.t("todayWelcomeStepsLabel"),
    });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.queryByText(i18n.t("todayFreeDayTitle"))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t("todayUpcomingTitle"))
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("link", { name: i18n.t("todayWelcomeAction") })
    );
    expect(await screen.findByText("programs-page")).toBeInTheDocument();
  });

  /** docs/specs/replay-welcome.md AC-2, AC-3 */
  it("shows the welcome again on request, with a way back to Today", async () => {
    const user = userEvent.setup();
    vi.mocked(listSchedule).mockResolvedValue(DUE_ROWS);
    renderPage("/?welcome=true");

    expect(
      await screen.findByRole("heading", { name: i18n.t("todayWelcomeTitle") })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: i18n.t("todayWelcomeAction") })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("todayStartAction") })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("link", { name: i18n.t("replayWelcomeBackAction") })
    );

    expect(
      await screen.findByRole("button", { name: i18n.t("todayStartAction") })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: i18n.t("todayWelcomeTitle") })
    ).not.toBeInTheDocument();
  });

  /** docs/specs/delight-day-done.md AC-1, AC-2, AC-4 */
  it("closes the day with the streak up front and what each program got", async () => {
    vi.mocked(listSchedule).mockResolvedValue([
      row({
        dueDate: new Date(NOW.getTime() + 20 * 24 * 60 * 60 * 1000),
        id: "far",
      }),
    ]);
    const todayKey = [
      NOW.getFullYear(),
      String(NOW.getMonth() + 1).padStart(2, "0"),
      String(NOW.getDate()).padStart(2, "0"),
    ].join("-");
    vi.mocked(listActivityCounts).mockResolvedValue([
      { activities: 2, count: 3, date: todayKey, programId: "p1" },
    ]);
    renderPage();

    expect(
      await screen.findByText(i18n.t("todayStreak", { count: 1 }))
    ).toBeInTheDocument();
    const byProgram = screen.getByRole("list", {
      name: i18n.t("todayDoneByProgramLabel"),
    });
    const rows = within(byProgram).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Cálculo I");
    // Nothing in the next 7 days: no strip of zeros.
    expect(
      screen.queryByText(i18n.t("todayUpcomingTitle"))
    ).not.toBeInTheDocument();
  });

  /** docs/specs/today-layout.md AC-1, AC-4 */
  it("puts Start right under the summary, with a readable overdue chip", async () => {
    vi.mocked(listSchedule).mockResolvedValue(DUE_ROWS);
    renderPage();

    const summary = await screen.findByText(
      i18n.t("todayDueSummary", { count: 3 })
    );
    const block = summary.closest("[data-slot='today-summary']");
    expect(block).not.toBeNull();
    expect(
      within(block as HTMLElement).getByRole("button", {
        name: i18n.t("todayStartAction"),
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("todayOverdueSummary", { count: 1 }))
    ).toHaveClass("text-destructive-text");
  });

  /** docs/specs/today-layout.md AC-2 */
  it("starts the day's session with Enter", async () => {
    const user = userEvent.setup();
    vi.mocked(listSchedule).mockResolvedValue(DUE_ROWS);
    renderPage();
    const start = await screen.findByRole("button", {
      name: i18n.t("todayStartAction"),
    });
    expect(start).toHaveAttribute("aria-keyshortcuts", "Enter");
    expect(start.querySelector("[data-slot='key-hint']")).toHaveTextContent(
      i18n.t("keyEnterLabel")
    );

    await user.keyboard("{Enter}");

    expect(
      within(await screen.findByRole("dialog")).getByText(
        i18n.t("todaySessionProgress", { current: 1, total: 3 })
      )
    ).toBeInTheDocument();
  });

  /** docs/specs/today-layout.md AC-3 */
  it("marks only the overdue items", async () => {
    vi.mocked(listSchedule).mockResolvedValue(DUE_ROWS);
    renderPage();

    // "Today" is also the page's title: look in the cards only.
    const calculus = await screen.findByRole("region", { name: "Cálculo I" });
    expect(
      within(calculus).queryByText(i18n.t("todayUrgencyToday"))
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("todayUrgencyOverdue", { count: 1 }))
    ).toBeInTheDocument();
  });
});
