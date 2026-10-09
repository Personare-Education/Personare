import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import ProgramFormDialog from "@/components/program-form-dialog";
import type { Program } from "@/components/programs-card-grid";
import "@/localization/i18n";

/** docs/specs/program-study-goal.md AC-4, AC-5. */

const RETAIN = /Never forget/;
const TEST_PREP = /Study for a test/;

function renderDialog(program: Program | null = null) {
  const onSubmit = vi.fn();
  render(
    <ProgramFormDialog
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
      open
      program={program}
    />
  );
  return { onSubmit };
}

async function typeName(name: string) {
  await userEvent.type(screen.getByLabelText(i18n.t("programNameLabel")), name);
}

function save() {
  return userEvent.click(
    screen.getByRole("button", { name: i18n.t("saveAction") })
  );
}

describe("ProgramFormDialog: the study goal", () => {
  it("offers both goals, 'Nunca mais esquecer' picked by default", () => {
    renderDialog();

    expect(screen.getByRole("radio", { name: RETAIN })).toBeChecked();
    expect(screen.getByRole("radio", { name: TEST_PREP })).not.toBeChecked();
    expect(
      screen.queryByLabelText(i18n.t("targetDateLabel"))
    ).not.toBeInTheDocument();
  });

  it("creates a program to never forget, without a date", async () => {
    const { onSubmit } = renderDialog();

    await typeName("Cálculo I");
    await save();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cálculo I",
        studyGoal: "retain",
        targetDate: null,
      })
    );
  });

  it("asks for the test day when studying for a test", async () => {
    const { onSubmit } = renderDialog();

    await typeName("Residência");
    await userEvent.click(screen.getByRole("radio", { name: TEST_PREP }));
    const date = screen.getByLabelText(i18n.t("targetDateLabel"));
    expect(date).toBeRequired();
    await userEvent.type(date, "2026-11-20");
    await save();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        studyGoal: "test_prep",
        targetDate: "2026-11-20",
      })
    );
  });

  it("shows the saved goal and day when editing", () => {
    renderDialog({
      color: "#6366f1",
      createdAt: new Date(),
      icon: "Rocket",
      id: "p1",
      name: "Residência",
      studyGoal: "test_prep",
      targetDate: "2026-11-20",
      updatedAt: new Date(),
    });

    expect(screen.getByRole("radio", { name: TEST_PREP })).toBeChecked();
    expect(screen.getByLabelText(i18n.t("targetDateLabel"))).toHaveValue(
      "2026-11-20"
    );
  });
});
