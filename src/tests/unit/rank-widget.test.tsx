import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import { RANK_STEPS, rankOf } from "@/utils/ranks";

const SILVER_II = /Prata II/;
const PAST_SEASON = /T3 2026/;

/**
 * RED phase (docs/specs/gamification.md §4 AC-2..5): the rank badge in the
 * sidebar, the Ranking, and the notices when the step changes.
 */

vi.mock("@/actions/points", () => ({
  getPointsSummary: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@/utils/sounds", () => ({ playVictory: vi.fn() }));

const { getPointsSummary } = await import("@/actions/points");
const { toast } = await import("sonner");
const { playVictory } = await import("@/utils/sounds");
const { SidebarProvider } = await import("@/components/ui/sidebar");
const { RankWidget } = await import("@/components/rank-widget");
const { notifyPointsChanged } = await import("@/utils/points-events");

function summary(points: number, extra: Record<string, unknown> = {}) {
  const rank = rankOf(points);
  return {
    pastSeasons: [],
    points,
    rank,
    recent: [
      {
        amount: 15,
        createdAt: new Date("2026-10-07T10:00:00"),
        kind: "review",
      },
      {
        amount: -2,
        createdAt: new Date("2026-10-07T09:00:00"),
        kind: "overdue",
      },
    ],
    season: {
      end: new Date("2027-01-01"),
      id: "2026-Q4",
      start: new Date("2026-10-01"),
    },
    toNext: rank.end === null ? null : rank.end - points,
    ...extra,
  };
}

function renderWidget() {
  return render(
    <SidebarProvider>
      <RankWidget />
    </SidebarProvider>
  );
}

describe("RankWidget (gamification.md §4)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("pt-BR");
  });

  it("shows the step, and the way to the next (AC-2)", async () => {
    // Silver II: 750 + 200 = 950 starts it.
    vi.mocked(getPointsSummary).mockResolvedValue(summary(1000) as never);
    renderWidget();

    expect(await screen.findByText("Prata II")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25"
    );
  });

  it("opens the Ranking: points, the whole ladder with the current step, the latest points and past seasons (AC-2)", async () => {
    const user = userEvent.setup();
    vi.mocked(getPointsSummary).mockResolvedValue(
      summary(1000, {
        pastSeasons: [
          { points: 2000, season: "2026-Q3", step: rankOf(2000).step },
        ],
      }) as never
    );
    renderWidget();

    await user.click(await screen.findByRole("button", { name: SILVER_II }));
    const ranking = await screen.findByRole("dialog", {
      name: i18n.t("rankingTitle"),
    });

    expect(
      within(ranking).getByText(i18n.t("rankPoints", { count: 1000 }))
    ).toBeInTheDocument();
    expect(
      within(ranking).getByText(
        i18n.t("rankToNext", { count: 150, rank: "Prata I" })
      )
    ).toBeInTheDocument();
    const ladder = within(ranking).getByRole("list", {
      name: i18n.t("rankLadderTitle"),
    });
    expect(within(ladder).getAllByRole("listitem")).toHaveLength(
      RANK_STEPS.length
    );
    expect(
      within(ladder).getByRole("listitem", { current: "step" })
    ).toHaveTextContent("Prata II");
    expect(within(ranking).getByText("+15")).toBeInTheDocument();
    expect(within(ranking).getByText("−2")).toBeInTheDocument();
    expect(within(ranking).getByText(PAST_SEASON)).toBeInTheDocument();
  });

  it("says when it climbs a step (AC-3)", async () => {
    vi.mocked(getPointsSummary)
      .mockResolvedValueOnce(summary(940) as never)
      .mockResolvedValue(summary(960) as never);
    renderWidget();
    await screen.findByText("Prata III");

    act(() => notifyPointsChanged());

    await screen.findByText("Prata II");
    expect(toast).toHaveBeenCalledWith(
      i18n.t("rankUpMessage", { rank: "Prata II" })
    );
    expect(playVictory).not.toHaveBeenCalled();
  });

  it("celebrates a new tier, with the victory sound (AC-3)", async () => {
    vi.mocked(getPointsSummary)
      .mockResolvedValueOnce(summary(1340) as never)
      .mockResolvedValue(summary(1360) as never);
    renderWidget();
    await screen.findByText("Prata I");

    act(() => notifyPointsChanged());

    await screen.findByText("Ouro III");
    expect(toast).toHaveBeenCalledWith(
      i18n.t("rankTierUpMessage", { rank: "Ouro III" })
    );
    expect(playVictory).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-celebrating]")).not.toBeNull();
  });

  it("says quietly when it drops a step (AC-3)", async () => {
    vi.mocked(getPointsSummary)
      .mockResolvedValueOnce(summary(960) as never)
      .mockResolvedValue(summary(940) as never);
    renderWidget();
    await screen.findByText("Prata II");

    act(() => notifyPointsChanged());

    await screen.findByText("Prata III");
    expect(toast).toHaveBeenCalledWith(
      i18n.t("rankDownMessage", { rank: "Prata III" })
    );
    expect(playVictory).not.toHaveBeenCalled();
  });

  it("names Magnum, with no division and nothing left to climb", async () => {
    vi.mocked(getPointsSummary).mockResolvedValue(summary(8000) as never);
    renderWidget();

    expect(await screen.findByText("Magnum")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "100"
      )
    );
  });
});
