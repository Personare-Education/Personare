import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (Issue #18, Spec Driven TDD): src/routes/calendar.tsx is still
 * the Issue #17 placeholder (`<h1>{t("navCalendar")}</h1>`) -- it does not
 * yet export a `CalendarPage` named export, call
 * ensureReviewItems/listSchedule, or render `<EventCalendar>`. Every test
 * below is expected to fail until the Developer implements
 * docs/specs/issue-18-calendario.md AC-4.
 *
 * This suite intentionally does NOT install or exercise the real
 * `@reui/event-calendar` component -- installing it is AC-1, explicitly the
 * Developer's job, not the Testador's. `@/components/reui/event-calendar`
 * (the barrel the spec's own composition example imports EventCalendar/
 * EventCalendarNav/EventCalendarContent from) is mocked here so these tests
 * only assert the OBSERVABLE wiring: ensureReviewItems then listSchedule
 * are called on mount, the rows are passed through toCalendarEvents, and
 * the mapped events end up in EventCalendar's `events` prop.
 * Rendering the real month/agenda grid is the ReUI library's own
 * responsibility, not re-tested here.
 *
 * CalendarPage must become a named export (in addition to the existing
 * default `Route` export) for it to be renderable in isolation -- the same
 * reasoning that already motivates every other *-dialog.tsx default export
 * in this codebase, just applied to a route component instead. It is
 * rendered inside a minimal TanStack Router harness (mirroring
 * src/tests/unit/app-sidebar.test.tsx) rather than standalone, since the
 * spec's renderEvent click handler needs a real `useNavigate()` context.
 */

vi.mock("@/actions/calendar", () => ({
  ensureReviewItems: vi.fn(),
  listSchedule: vi.fn(),
  toCalendarEvents: vi.fn(),
}));

vi.mock("@/components/reui/event-calendar", () => ({
  EventCalendar: vi.fn(({ children }: { children?: ReactNode }) => (
    <div data-testid="event-calendar">{children}</div>
  )),
  EventCalendarContent: () => <div data-testid="event-calendar-content" />,
  EventCalendarNav: () => <div data-testid="event-calendar-nav" />,
}));

vi.mock("@/actions/calendar-sync", () => ({
  getCalendarConnectionStatus: vi.fn(),
  syncCalendar: vi.fn(),
}));

const { ensureReviewItems, listSchedule, toCalendarEvents } = await import(
  "@/actions/calendar"
);
const { EventCalendar } = await import("@/components/reui/event-calendar");
const { getCalendarConnectionStatus, syncCalendar } = await import(
  "@/actions/calendar-sync"
);
const { CalendarPage } = await import("@/routes/calendar");

const SCHEDULE_ROWS = [
  {
    activityId: "a1",
    activityTitle: "Baralho de fixacao",
    dueDate: new Date("2026-02-01T00:00:00Z"),
    front: "Brasilia",
    id: "r1",
    moduleId: "m1",
    moduleName: "Geografia",
    programId: "p1",
  },
];

const MAPPED_EVENTS = [
  {
    allDay: true,
    data: { date: "2026-02-01", moduleId: "m1", programId: "p1" },
    end: new Date("2026-02-02T00:00:00Z"),
    id: "r1",
    readOnly: true,
    start: new Date("2026-02-01T00:00:00Z"),
    title: "Geografia",
  },
];

function ProgramLocation() {
  const location = useRouterState({ select: (state) => state.location });

  return (
    <p data-testid="program-location">
      {location.pathname}?{location.searchStr.slice(1)}
    </p>
  );
}

function renderCalendarPage() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const calendarRoute = createRoute({
    component: CalendarPage,
    getParentRoute: () => rootRoute,
    path: "/calendar",
  });
  const programRoute = createRoute({
    component: ProgramLocation,
    getParentRoute: () => rootRoute,
    path: "/programs/$programId",
  });
  const routeTree = rootRoute.addChildren([calendarRoute, programRoute]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/calendar"] }),
    routeTree,
  });

  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ensureReviewItems).mockResolvedValue(undefined);
  vi.mocked(listSchedule).mockResolvedValue(SCHEDULE_ROWS);
  vi.mocked(toCalendarEvents).mockReturnValue(MAPPED_EVENTS);
  vi.mocked(getCalendarConnectionStatus).mockResolvedValue(false);
});

describe("CalendarPage (Issue #18)", () => {
  it("calls ensureReviewItems and then listSchedule on mount", async () => {
    renderCalendarPage();

    await waitFor(() => {
      expect(listSchedule).toHaveBeenCalled();
    });
    expect(ensureReviewItems).toHaveBeenCalled();
    expect(
      vi.mocked(ensureReviewItems).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(listSchedule).mock.invocationCallOrder[0]);
  });

  it("maps the rows returned by listSchedule through toCalendarEvents", async () => {
    renderCalendarPage();

    await waitFor(() => {
      expect(toCalendarEvents).toHaveBeenCalledWith(SCHEDULE_ROWS);
    });
  });

  it("passes the events from toCalendarEvents to EventCalendar's events prop", async () => {
    renderCalendarPage();

    await waitFor(() => {
      const lastCall = vi.mocked(EventCalendar).mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(
        expect.objectContaining({ events: MAPPED_EVENTS })
      );
    });
  });

  it("renders EventCalendarNav and EventCalendarContent inside EventCalendar", async () => {
    renderCalendarPage();

    expect(await screen.findByTestId("event-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("event-calendar-nav")).toBeInTheDocument();
    expect(screen.getByTestId("event-calendar-content")).toBeInTheDocument();
  });

  /**
   * The Calendar's own nav/view-switcher strings ("Today", "Month", ...)
   * were hardcoded English regardless of the app's active language --
   * EventCalendar already exposes an `i18n`/`locale` override for this
   * (src/utils/event-calendar-i18n.ts bridges it to i18next's `t`), it just
   * wasn't wired up.
   */
  it("passes translated i18n labels and a matching date-fns locale to EventCalendar", async () => {
    renderCalendarPage();

    await waitFor(() => {
      const lastCall = vi.mocked(EventCalendar).mock.calls.at(-1);
      expect(lastCall?.[0].i18n).toEqual(
        expect.objectContaining({
          labels: expect.objectContaining({
            next: i18n.t("calendarNextAction"),
            previous: i18n.t("calendarPreviousAction"),
            today: i18n.t("calendarTodayAction"),
          }),
        })
      );
      expect(lastCall?.[0].locale?.code).toBe("en-US");
    });
  });
});

describe("CalendarPage Google Calendar sync (Issue #26)", () => {
  it("disables the sync action until the calendar is connected", async () => {
    renderCalendarPage();

    expect(
      await screen.findByRole("button", { name: i18n.t("syncCalendarAction") })
    ).toBeDisabled();
  });

  /** docs/specs/rating-clarity.md AC-4 */
  it("says why the sync action is disabled", async () => {
    renderCalendarPage();

    expect(
      await screen.findByText(i18n.t("calendarSyncDisabledHint"))
    ).toBeInTheDocument();
  });

  it("enables the sync action once the calendar is connected", async () => {
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    renderCalendarPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: i18n.t("syncCalendarAction") })
      ).not.toBeDisabled();
    });
  });

  it("syncs the currently loaded schedule rows and shows the reconciliation counts", async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "UTC";

    try {
      vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
      vi.mocked(syncCalendar).mockResolvedValue({
        created: 1,
        deleted: 0,
        updated: 2,
      });
      const user = userEvent.setup();
      renderCalendarPage();
      const button = await screen.findByRole("button", {
        name: i18n.t("syncCalendarAction"),
      });
      await waitFor(() => expect(button).not.toBeDisabled());

      await user.click(button);

      await waitFor(() => {
        expect(syncCalendar).toHaveBeenCalledWith([
          {
            dueDate: "2026-02-01",
            front: "Brasilia",
            id: "r1",
          },
        ]);
      });
      expect(
        await screen.findByText(
          i18n.t("calendarSyncResultMessage", {
            created: 1,
            deleted: 0,
            updated: 2,
          })
        )
      ).toBeInTheDocument();
    } finally {
      process.env.TZ = originalTz;
    }
  });

  /**
   * Regression test: syncing used to send row.dueDate.toISOString() (a UTC
   * timestamp) straight to the backend, which then sliced its date portion
   * -- also in UTC. A dueDate whose local time-of-day is late enough (or
   * whose timezone offset is positive) crosses into the next/previous UTC
   * calendar day, so the Google Calendar event landed on the wrong day
   * (reported: app said day 21, Google Calendar showed day 22). Pinning TZ
   * to a fixed UTC-3 zone (America/Sao_Paulo has had no DST since 2019)
   * reproduces that mismatch deterministically regardless of which
   * timezone actually runs this test suite.
   */
  it("sends the review's local calendar day, not its UTC day, so it doesn't land on the wrong day", async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo";

    try {
      vi.mocked(listSchedule).mockResolvedValue([
        {
          activityId: "a2",
          activityTitle: "Baralho de fixacao",
          // 2026-02-02T01:00:00Z is 2026-02-01 22:00 in UTC-3 -- local day
          // is Feb 1, UTC day is Feb 2.
          dueDate: new Date("2026-02-02T01:00:00Z"),
          front: "Rio de Janeiro",
          id: "r2",
          moduleId: "m1",
          moduleName: "Geografia",
          programId: "p1",
        },
      ]);
      vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
      vi.mocked(syncCalendar).mockResolvedValue({
        created: 1,
        deleted: 0,
        updated: 0,
      });
      const user = userEvent.setup();
      renderCalendarPage();
      const button = await screen.findByRole("button", {
        name: i18n.t("syncCalendarAction"),
      });
      await waitFor(() => expect(button).not.toBeDisabled());

      await user.click(button);

      await waitFor(() => {
        expect(syncCalendar).toHaveBeenCalledWith([
          {
            dueDate: "2026-02-01",
            front: "Rio de Janeiro",
            id: "r2",
          },
        ]);
      });
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("shows a not-connected message when the backend reports calendar_not_connected", async () => {
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    vi.mocked(syncCalendar).mockResolvedValue({
      error: "calendar_not_connected",
    });
    const user = userEvent.setup();
    renderCalendarPage();
    const button = await screen.findByRole("button", {
      name: i18n.t("syncCalendarAction"),
    });
    await waitFor(() => expect(button).not.toBeDisabled());

    await user.click(button);

    expect(
      await screen.findByText(i18n.t("calendarNotConnectedErrorMessage"))
    ).toBeInTheDocument();
  });

  it("shows a reconnect message when the backend reports calendar_reconnect_required", async () => {
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    vi.mocked(syncCalendar).mockResolvedValue({
      error: "calendar_reconnect_required",
    });
    const user = userEvent.setup();
    renderCalendarPage();
    const button = await screen.findByRole("button", {
      name: i18n.t("syncCalendarAction"),
    });
    await waitFor(() => expect(button).not.toBeDisabled());

    await user.click(button);

    expect(
      await screen.findByText(i18n.t("calendarReconnectRequiredErrorMessage"))
    ).toBeInTheDocument();
  });

  it("shows a generic error message when syncCalendar rejects", async () => {
    vi.mocked(getCalendarConnectionStatus).mockResolvedValue(true);
    vi.mocked(syncCalendar).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderCalendarPage();
    const button = await screen.findByRole("button", {
      name: i18n.t("syncCalendarAction"),
    });
    await waitFor(() => expect(button).not.toBeDisabled());

    await user.click(button);

    expect(
      await screen.findByText(i18n.t("calendarSyncErrorMessage"))
    ).toBeInTheDocument();
  });
});

/**
 * docs/specs/calendar-module-review-highlight.md AC-2: clicking an event
 * opens the module's program with that module (and day) in focus.
 */
describe("CalendarPage event click", () => {
  it("opens the program with the event's module and day in focus", async () => {
    renderCalendarPage();

    await waitFor(() => {
      expect(vi.mocked(EventCalendar).mock.calls.at(-1)?.[0].events).toEqual(
        MAPPED_EVENTS
      );
    });
    const [lastProps] = vi.mocked(EventCalendar).mock.calls.at(-1) ?? [];
    const { onEventClick } = lastProps as unknown as {
      onEventClick: (occurrence: {
        event: (typeof MAPPED_EVENTS)[number];
      }) => void;
    };
    act(() => onEventClick({ event: MAPPED_EVENTS[0] }));

    expect(await screen.findByTestId("program-location")).toHaveTextContent(
      "/programs/p1?focusDate=2026-02-01&focusModuleId=m1"
    );
  });
});
