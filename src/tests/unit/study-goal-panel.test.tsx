import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/** docs/specs/program-study-goal.md AC-4, AC-5. */

vi.mock("@/actions/programs", () => ({
  setProgramStudyGoal: vi.fn().mockResolvedValue({}),
}));

const { setProgramStudyGoal } = await import("@/actions/programs");
const { default: StudyGoalPanel } = await import(
  "@/components/study-goal-panel"
);

const RETAIN = /Never forget/;
const TEST_PREP = /Study for a test/;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StudyGoalPanel", () => {
  it("shows both goals with the saved one picked", () => {
    render(
      <StudyGoalPanel programId="p1" studyGoal="retain" targetDate={null} />
    );

    expect(screen.getByRole("radio", { name: RETAIN })).toBeChecked();
    expect(screen.getByRole("radio", { name: TEST_PREP })).not.toBeChecked();
    expect(
      screen.queryByLabelText(i18n.t("targetDateLabel"), { exact: true })
    ).not.toBeInTheDocument();
  });

  it("asks for the test day, and saves once it is filled in", async () => {
    const onChange = vi.fn();
    render(
      <StudyGoalPanel
        onChange={onChange}
        programId="p1"
        studyGoal="retain"
        targetDate={null}
      />
    );

    await userEvent.click(screen.getByRole("radio", { name: TEST_PREP }));
    expect(setProgramStudyGoal).not.toHaveBeenCalled();
    const date = screen.getByLabelText(i18n.t("targetDateLabel"), {
      exact: true,
    });
    expect(date).toBeRequired();
    await userEvent.type(date, "2026-11-20");

    expect(setProgramStudyGoal).toHaveBeenLastCalledWith(
      "p1",
      "test_prep",
      "2026-11-20"
    );
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("saves 'Nunca mais esquecer' right away, dropping the day", async () => {
    render(
      <StudyGoalPanel
        programId="p1"
        studyGoal="test_prep"
        targetDate="2026-11-20"
      />
    );

    expect(
      screen.getByLabelText(i18n.t("targetDateLabel"), { exact: true })
    ).toHaveValue("2026-11-20");
    await userEvent.click(screen.getByRole("radio", { name: RETAIN }));

    expect(setProgramStudyGoal).toHaveBeenCalledWith("p1", "retain", null);
  });

  it("saves the test again when going back to it with the day kept", async () => {
    render(
      <StudyGoalPanel
        programId="p1"
        studyGoal="test_prep"
        targetDate="2026-11-20"
      />
    );

    await userEvent.click(screen.getByRole("radio", { name: RETAIN }));
    await userEvent.click(screen.getByRole("radio", { name: TEST_PREP }));

    expect(setProgramStudyGoal).toHaveBeenLastCalledWith(
      "p1",
      "test_prep",
      "2026-11-20"
    );
  });
});
