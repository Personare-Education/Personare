import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProgramFormDialog from "@/components/program-form-dialog";
import type { Program } from "@/components/programs-card-grid";
import {
  DEFAULT_PROGRAM_COLOR,
  DEFAULT_PROGRAM_ICON_NAME,
} from "@/constants/program-appearance";
import "@/localization/i18n";

/**
 * RED phase (Issue #99 revision, Spec Driven TDD): program-form-dialog.tsx
 * does not yet have an icon/color picker. Every test below is expected to
 * fail until the Developer implements it, per
 * docs/specs/issue-99-programs-cards-heatmap.md AC-12.
 */

const EXISTING_PROGRAM: Program = {
  color: "#6366f1",
  createdAt: new Date("2026-01-01"),
  icon: "Rocket",
  id: "11111111-1111-1111-1111-111111111111",
  name: "Bacharelado II",
  updatedAt: new Date("2026-01-01"),
};

function renderDialog(program: Program | null = null) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <ProgramFormDialog
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={true}
      program={program}
    />
  );

  return { onOpenChange, onSubmit };
}

describe("ProgramFormDialog icon/color picker (Issue #99 revision)", () => {
  it("defaults to the default icon and color when creating a new program", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: DEFAULT_PROGRAM_ICON_NAME })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: DEFAULT_PROGRAM_COLOR })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("pre-selects the existing program's icon and color when editing", () => {
    renderDialog(EXISTING_PROGRAM);

    expect(screen.getByRole("button", { name: "Rocket" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "#6366f1" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("selects a different icon on click", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Brain" }));

    expect(screen.getByRole("button", { name: "Brain" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("button", { name: DEFAULT_PROGRAM_ICON_NAME })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("selects a different color on click", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "#6366f1" }));

    expect(screen.getByRole("button", { name: "#6366f1" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("submits the name, icon and color together", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByLabelText("Name"), "Novo Programa");
    await user.click(screen.getByRole("button", { name: "Brain" }));
    await user.click(screen.getByRole("button", { name: "#6366f1" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledWith({
      color: "#6366f1",
      icon: "Brain",
      name: "Novo Programa",
    });
  });
});
