import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  importProgram: vi.fn(),
  listProgramActivityCounts: vi.fn().mockResolvedValue([]),
  listPrograms: vi.fn(),
  previewProgramImport: vi.fn(),
  restoreProgram: vi.fn(),
  softDeleteProgram: vi.fn(),
  undoProgramImport: vi.fn().mockResolvedValue(undefined),
  updateProgram: vi.fn(),
}));
vi.mock("@/utils/undo-toast", () => ({ showUndoToast: vi.fn() }));
vi.mock("@/components/program-import-dialog", () => ({
  // Stands in for the dialog: importing hands back a report at once.
  default: ({
    onImported,
    open,
  }: {
    onImported: (report: unknown) => void;
    open: boolean;
  }) =>
    open ? (
      <button
        // biome-ignore lint/performance/noJsxPropsBind: a one-off test stand-in.
        onClick={() =>
          onImported({
            created: {
              activityIds: [],
              examIds: [],
              moduleIds: [],
              programId: "p9",
            },
            programId: "p9",
            programName: "Importado",
          })
        }
        type="button"
      >
        stub-import
      </button>
    ) : null,
}));
vi.mock("@/hooks/use-due-count", () => ({
  useDueReviews: () => ({ byProgram: new Map(), total: 0 }),
}));

const { listPrograms, undoProgramImport } = await import("@/actions/programs");
const { showUndoToast } = await import("@/utils/undo-toast");
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
  const programRoute = createRoute({
    component: () => <p>program page</p>,
    getParentRoute: () => rootRoute,
    path: "/programs/$programId",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: rootRoute.addChildren([programsRoute, programRoute]),
  });
  render(<RouterProvider router={router} />);
  return router;
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

  describe("importing a program (program-import.md §3 AC-1, AC-3)", () => {
    it("offers Import program in the header and in the empty state", async () => {
      vi.mocked(listPrograms).mockResolvedValue([]);
      renderPage();
      // Once loaded, the empty state has its own buttons.
      await screen.findByRole("heading", {
        name: i18n.t("programsEmptyTitle"),
      });

      expect(
        screen.getByRole("button", { name: i18n.t("importProgramAction") })
      ).toBeInTheDocument();
    });

    it("opens the imported program, with Undo", async () => {
      const user = userEvent.setup();
      vi.mocked(listPrograms).mockResolvedValue([]);
      const router = renderPage();
      await screen.findByRole("heading", {
        name: i18n.t("programsEmptyTitle"),
      });

      await user.click(
        screen.getByRole("button", { name: i18n.t("importProgramAction") })
      );
      await user.click(screen.getByRole("button", { name: "stub-import" }));

      await waitFor(() =>
        expect(router.state.location.pathname).toBe("/programs/p9")
      );
      const [[toast]] = vi.mocked(showUndoToast).mock.calls;
      expect(toast.message).toBe(
        i18n.t("programImportedMessage", { name: "Importado" })
      );
      toast.onUndo();
      expect(undoProgramImport).toHaveBeenCalledWith({
        activityIds: [],
        examIds: [],
        moduleIds: [],
        programId: "p9",
      });
    });
  });
});
