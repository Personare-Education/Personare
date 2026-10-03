import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (docs/specs/onboard-empty-states.md AC-1, AC-3, AC-6): the
 * Programs page explains itself when empty, keeps a single create button,
 * and opens the new-program form when it arrives with ?new=true.
 */

vi.mock("@/actions/programs", () => ({
  createProgram: vi.fn(),
  groupActivityCountsByProgram: vi.fn(() => new Map()),
  listProgramActivityCounts: vi.fn().mockResolvedValue([]),
  listPrograms: vi.fn(),
  restoreProgram: vi.fn(),
  softDeleteProgram: vi.fn(),
  updateProgram: vi.fn(),
}));
vi.mock("@/hooks/use-due-count", () => ({
  useDueReviews: () => ({ byProgram: new Map(), total: 0 }),
}));

const { listPrograms } = await import("@/actions/programs");
const { ProgramsPage, validateProgramsSearch } = await import(
  "@/routes/programs.index"
);

function renderPage(path = "/programs") {
  const rootRoute = createRootRoute();
  const programsRoute = createRoute({
    component: ProgramsPage,
    getParentRoute: () => rootRoute,
    path: "/programs",
    validateSearch: validateProgramsSearch,
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: rootRoute.addChildren([programsRoute]),
  });
  render(<RouterProvider router={router} />);
}

const createName = () => i18n.t("createProgramAction");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProgramsPage", () => {
  it("explains an empty list, with a single create button", async () => {
    vi.mocked(listPrograms).mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: i18n.t("programsEmptyTitle") })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: createName() })).toHaveLength(
      1
    );
  });

  it("keeps the header's create button once there are programs", async () => {
    vi.mocked(listPrograms).mockResolvedValue([
      {
        color: "#3b6cf6",
        createdAt: new Date(),
        icon: null,
        id: "p1",
        name: "Cálculo I",
        updatedAt: new Date(),
      },
    ] as never);
    renderPage();

    expect(await screen.findByText("Cálculo I")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: i18n.t("programsEmptyTitle") })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: createName() })
    ).toBeInTheDocument();
  });

  it("opens the new-program form when asked to with ?new=true", async () => {
    vi.mocked(listPrograms).mockResolvedValue([]);
    renderPage("/programs?new=true");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
