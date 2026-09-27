import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useCallback } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOCUSED_MODULE_REDIRECT_MS,
  useFocusedModuleRedirect,
} from "@/hooks/use-focused-module-redirect";

/**
 * RED phase (docs/specs/calendar-module-review-highlight.md AC-4):
 * src/hooks/use-focused-module-redirect.ts does not exist yet. On the
 * program page, a module in focus (from a calendar click) pulses for 2.5
 * seconds, then the app moves on to that module -- replacing the program
 * page in history, so going back from the module lands on the calendar
 * instead of bouncing into the module again.
 */

function OpenModuleButton({
  moduleId,
  onOpen,
}: {
  moduleId: string;
  onOpen: (moduleId: string) => void;
}) {
  const handleClick = useCallback(() => onOpen(moduleId), [moduleId, onOpen]);

  return (
    <button onClick={handleClick} type="button">
      open {moduleId}
    </button>
  );
}

function ProgramPage() {
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, string>,
  });
  const { openModule } = useFocusedModuleRedirect({
    focusDate: search.focusDate,
    focusModuleId: search.focusModuleId,
    programId: "p1",
  });

  return (
    <>
      <p>program page</p>
      {["m1", "m2"].map((moduleId) => (
        <OpenModuleButton
          key={moduleId}
          moduleId={moduleId}
          onOpen={openModule}
        />
      ))}
    </>
  );
}

function Location() {
  const location = useRouterState({ select: (state) => state.location });

  return (
    <p data-testid="location">
      {location.pathname}
      {location.searchStr}
    </p>
  );
}

function renderAt(entries: string[]) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Outlet />
        <Location />
      </>
    ),
  });
  const routeTree = rootRoute.addChildren([
    createRoute({
      component: () => <p>calendar</p>,
      getParentRoute: () => rootRoute,
      path: "/calendar",
    }),
    createRoute({
      component: ProgramPage,
      getParentRoute: () => rootRoute,
      path: "/programs/$programId",
    }),
    createRoute({
      component: () => <p>module page</p>,
      getParentRoute: () => rootRoute,
      path: "/programs/$programId/modules/$moduleId",
    }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: entries,
      initialIndex: entries.length - 1,
    }),
    routeTree,
  });
  render(<RouterProvider router={router} />);

  return router;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useFocusedModuleRedirect", () => {
  it("pulses the module for 2.5 seconds before opening it", () => {
    expect(FOCUSED_MODULE_REDIRECT_MS).toBe(2500);
  });

  it("opens the focused module once the pulse is over, keeping the focus day", async () => {
    renderAt([
      "/calendar",
      "/programs/p1?focusModuleId=m1&focusDate=2026-03-15",
    ]);
    expect(await screen.findByText("program page")).toBeInTheDocument();

    await act(() =>
      vi.advanceTimersByTimeAsync(FOCUSED_MODULE_REDIRECT_MS - 100)
    );
    expect(screen.getByText("program page")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(await screen.findByText("module page")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/programs/p1/modules/m1?focusDate=2026-03-15"
    );
  });

  it("replaces the program page in history, so back goes to the calendar", async () => {
    const router = renderAt([
      "/calendar",
      "/programs/p1?focusModuleId=m1&focusDate=2026-03-15",
    ]);
    await act(() =>
      vi.advanceTimersByTimeAsync(FOCUSED_MODULE_REDIRECT_MS + 100)
    );
    expect(await screen.findByText("module page")).toBeInTheDocument();

    await act(async () => {
      router.history.back();
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(await screen.findByText("calendar")).toBeInTheDocument();
  });

  it("does nothing without a module in focus", async () => {
    renderAt(["/programs/p1"]);
    await act(() =>
      vi.advanceTimersByTimeAsync(FOCUSED_MODULE_REDIRECT_MS * 2)
    );

    expect(screen.getByText("program page")).toBeInTheDocument();
  });

  it("does not redirect once the user has left the program page", async () => {
    const router = renderAt([
      "/calendar",
      "/programs/p1?focusModuleId=m1&focusDate=2026-03-15",
    ]);
    expect(await screen.findByText("program page")).toBeInTheDocument();

    await act(async () => {
      await router.navigate({ to: "/calendar" });
    });
    await act(() =>
      vi.advanceTimersByTimeAsync(FOCUSED_MODULE_REDIRECT_MS * 2)
    );

    expect(screen.getByText("calendar")).toBeInTheDocument();
    expect(screen.queryByText("module page")).not.toBeInTheDocument();
  });

  /**
   * The user may open the module themselves before the pulse is over: the
   * flow goes on the same way, the day's activities still pulse there.
   */
  it("keeps the focus day when the focused module is opened before the pulse ends", async () => {
    renderAt([
      "/calendar",
      "/programs/p1?focusModuleId=m1&focusDate=2026-03-15",
    ]);
    expect(await screen.findByText("program page")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open m1" }));

    expect(await screen.findByText("module page")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/programs/p1/modules/m1?focusDate=2026-03-15"
    );
  });

  it("opens any other module without the focus day", async () => {
    renderAt([
      "/calendar",
      "/programs/p1?focusModuleId=m1&focusDate=2026-03-15",
    ]);
    expect(await screen.findByText("program page")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open m2" }));

    expect(await screen.findByText("module page")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe(
      "/programs/p1/modules/m2"
    );
  });
});
