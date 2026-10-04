import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

vi.mock("@/actions/streak", () => ({
  listActivityCounts: vi.fn(),
}));

const { listActivityCounts } = await import("@/actions/streak");
const { SidebarProvider } = await import("@/components/ui/sidebar");
const { StreakWidget } = await import("@/components/streak-widget");
const { notifyReviewCompleted } = await import("@/utils/review-events");

function renderWidget() {
  return render(
    <SidebarProvider>
      <StreakWidget />
    </SidebarProvider>
  );
}

describe("StreakWidget", () => {
  beforeEach(() => {
    // Only Date is faked -- setInterval/setTimeout stay real so
    // testing-library's own findBy/waitFor polling (which relies on real
    // timers) keeps working without manual vi.advanceTimersByTime calls.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    vi.mocked(listActivityCounts).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the current streak count on the sidebar trigger", async () => {
    vi.mocked(listActivityCounts).mockResolvedValue([
      { activities: 1, count: 1, date: "2026-03-13", programId: "p1" },
      { activities: 1, count: 1, date: "2026-03-14", programId: "p1" },
      { activities: 1, count: 1, date: "2026-03-15", programId: "p2" },
    ]);

    renderWidget();

    expect(
      await screen.findByText(i18n.t("streakDaysLabel", { count: 3 }))
    ).toBeInTheDocument();
  });

  it("shows a 0-day streak when there is no activity yet", async () => {
    vi.mocked(listActivityCounts).mockResolvedValue([]);

    renderWidget();

    expect(
      await screen.findByText(i18n.t("streakDaysLabel", { count: 0 }))
    ).toBeInTheDocument();
  });

  /** docs/specs/onboard-empty-states.md AC-8 */
  it("says there is no streak yet instead of 0 days", async () => {
    vi.mocked(listActivityCounts).mockResolvedValue([]);

    renderWidget();

    expect(
      await screen.findByText(i18n.t("streakDaysLabel", { count: 0 }))
    ).toHaveTextContent(i18n.t("streakNoneYetLabel"));
  });

  /** docs/specs/contrast-translation.md AC-4 */
  it("makes the month buttons 24px targets", async () => {
    const user = userEvent.setup();
    vi.mocked(listActivityCounts).mockResolvedValue([]);
    renderWidget();
    await user.click(await screen.findByRole("button"));

    expect(
      await screen.findByRole("button", {
        name: i18n.t("calendarPreviousAction"),
      })
    ).toHaveAttribute("data-size", "icon-sm");
    expect(
      screen.getByRole("button", { name: i18n.t("calendarNextAction") })
    ).toHaveAttribute("data-size", "icon-sm");
  });

  it("opens a popover with today's day-of-month, streak stats and the hint message", async () => {
    const user = userEvent.setup();
    vi.mocked(listActivityCounts).mockResolvedValue([
      { activities: 1, count: 1, date: "2026-03-14", programId: "p1" },
      { activities: 1, count: 1, date: "2026-03-15", programId: "p1" },
    ]);
    renderWidget();
    await screen.findByText(i18n.t("streakDaysLabel", { count: 2 }));

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("streakDaysLabel", { count: 2 }),
      })
    );

    expect(
      screen.getByText(i18n.t("streakDayOfMonthLabel", { day: 15 }))
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t("streakCurrentLabel"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("streakBestLabel"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("streakHintMessage"))).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("streakResetsAtMidnightMessage"))
    ).toBeInTheDocument();
  });

  /**
   * RED phase (streak-refresh bug fix, Spec Driven TDD): the sidebar count
   * never refreshes after mount -- reported bug: rating an Activity did not
   * move the streak from 0 to 1 without relaunching the app.
   */
  it("refreshes the streak count when a review completes elsewhere in the app", async () => {
    vi.mocked(listActivityCounts).mockResolvedValue([]);
    renderWidget();
    await screen.findByText(i18n.t("streakDaysLabel", { count: 0 }));

    vi.mocked(listActivityCounts).mockResolvedValue([
      { activities: 1, count: 1, date: "2026-03-15", programId: "p1" },
    ]);
    notifyReviewCompleted();

    expect(
      await screen.findByText(i18n.t("streakDaysLabel", { count: 1 }))
    ).toBeInTheDocument();
  });

  it("navigates to the next and previous month", async () => {
    const user = userEvent.setup();
    vi.mocked(listActivityCounts).mockResolvedValue([]);
    renderWidget();
    await screen.findByText(i18n.t("streakDaysLabel", { count: 0 }));

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("streakDaysLabel", { count: 0 }),
      })
    );

    expect(screen.getByText("March 2026")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: i18n.t("calendarNextAction") })
    );
    expect(screen.getByText("April 2026")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: i18n.t("calendarPreviousAction") })
    );
    expect(screen.getByText("March 2026")).toBeInTheDocument();
  });
});
