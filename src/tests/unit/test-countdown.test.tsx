import { render, screen } from "@testing-library/react";
import { addDays, format } from "date-fns";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import ProgramsCardGrid, {
  type Program,
} from "@/components/programs-card-grid";
import "@/localization/i18n";

/** docs/specs/test-prep-scheduling.md AC-4. */

const inDays = (days: number) =>
  format(addDays(new Date(), days), "yyyy-MM-dd");

function renderCard(goal: Partial<Program>) {
  render(
    <ProgramsCardGrid
      activityCountsByProgramId={new Map()}
      onEdit={vi.fn()}
      onNavigateToModules={vi.fn()}
      onRequestDelete={vi.fn()}
      programs={[
        {
          color: "#3b82f6",
          createdAt: new Date(),
          icon: null,
          id: "p1",
          name: "Residência",
          updatedAt: new Date(),
          ...goal,
        },
      ]}
    />
  );
}

describe("the test countdown on a program's card", () => {
  it("says how many days are left", () => {
    renderCard({ studyGoal: "test_prep", targetDate: inDays(12) });
    expect(
      screen.getByText(i18n.t("testCountdown", { count: 12 }))
    ).toBeInTheDocument();
  });

  it("says when the test is today", () => {
    renderCard({ studyGoal: "test_prep", targetDate: inDays(0) });
    expect(screen.getByText(i18n.t("testToday"))).toBeInTheDocument();
  });

  it("says when it was, once it passed", () => {
    renderCard({ studyGoal: "test_prep", targetDate: inDays(-3) });
    expect(screen.getByTestId("test-countdown")).toHaveTextContent(
      i18n.t("testWasOn", { date: "" }).trim().split(" ")[0]
    );
  });

  it("isn't there for 'Nunca mais esquecer'", () => {
    renderCard({ studyGoal: "retain", targetDate: null });
    expect(screen.queryByTestId("test-countdown")).not.toBeInTheDocument();
  });
});
