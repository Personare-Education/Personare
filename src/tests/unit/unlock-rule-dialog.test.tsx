import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import UnlockRuleDialog from "@/components/unlock-rule-dialog";

/**
 * RED phase (docs/specs/sequences-and-locks.md §4 AC-1): choosing how an
 * activity or a module unlocks.
 */

const GROUPS = [
  {
    items: [
      { id: "a", title: "Capítulo 1" },
      { id: "b", title: "Videoaula" },
    ],
    label: "Esqueleto",
  },
  { items: [{ id: "c", title: "Quiz de músculos" }], label: "Músculos" },
];

function renderDialog(mode = "none", requiredIds: string[] = []) {
  const onSave = vi.fn();
  render(
    <UnlockRuleDialog
      candidates={GROUPS}
      mode={mode}
      onOpenChange={vi.fn()}
      onSave={onSave}
      open
      requiredIds={requiredIds}
      subjectTitle="Quiz final"
    />
  );
  return { onSave };
}

describe("UnlockRuleDialog", () => {
  it("opens on the current rule", () => {
    renderDialog("any", ["b"]);

    expect(
      screen.getByRole("radio", { name: i18n.t("unlockModeAny") })
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Videoaula" })).toBeChecked();
    expect(screen.getByRole("group", { name: "Músculos" })).toBeInTheDocument();
  });

  it("saves an all-of rule with the items checked", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.click(
      screen.getByRole("radio", { name: i18n.t("unlockModeAll") })
    );
    const save = screen.getByRole("button", { name: i18n.t("saveAction") });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Capítulo 1" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Quiz de músculos" })
    );
    await user.click(save);

    expect(onSave).toHaveBeenCalledWith("all", ["a", "c"]);
  });

  it("saves 'everything before it' without a list", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog("any", ["a"]);

    await user.click(
      screen.getByRole("radio", { name: i18n.t("unlockModePrevious") })
    );
    expect(
      screen.queryByRole("checkbox", { name: "Capítulo 1" })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(onSave).toHaveBeenCalledWith("previous", []);
  });

  it("names the dialog after what it unlocks", () => {
    renderDialog();

    expect(
      within(screen.getByRole("dialog")).getByText(
        i18n.t("unlockRuleTitle", { title: "Quiz final" })
      )
    ).toBeInTheDocument();
  });
});
