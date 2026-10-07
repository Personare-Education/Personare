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

  describe("after passing an exam (exams.md §4 AC-1, AC-5)", () => {
    const EXAMS = [
      { id: "e1", title: "Prova 1" },
      { id: "e2", title: "Prova 2" },
    ];

    function renderModuleDialog(mode = "none", requiredIds: string[] = []) {
      const onSave = vi.fn();
      render(
        <UnlockRuleDialog
          candidates={GROUPS}
          exams={EXAMS}
          mode={mode}
          onOpenChange={vi.fn()}
          onSave={onSave}
          open
          requiredIds={requiredIds}
          subjectTitle="Músculos"
        />
      );
      return { onSave };
    }

    it("is not offered without exams (an activity's rule)", () => {
      renderDialog();

      expect(
        screen.queryByRole("radio", { name: i18n.t("unlockModeExam") })
      ).not.toBeInTheDocument();
    });

    it("saves the one exam chosen", async () => {
      const user = userEvent.setup();
      const { onSave } = renderModuleDialog();

      await user.click(
        screen.getByRole("radio", { name: i18n.t("unlockModeExam") })
      );
      const save = screen.getByRole("button", { name: i18n.t("saveAction") });
      expect(save).toBeDisabled();
      await user.click(screen.getByRole("radio", { name: "Prova 2" }));
      await user.click(screen.getByRole("radio", { name: "Prova 1" }));
      await user.click(save);

      expect(onSave).toHaveBeenCalledWith("exam", ["e1"]);
    });

    it("opens on the exam saved", () => {
      renderModuleDialog("exam", ["e2"]);

      expect(
        screen.getByRole("radio", { name: i18n.t("unlockModeExam") })
      ).toBeChecked();
      expect(screen.getByRole("radio", { name: "Prova 2" })).toBeChecked();
    });

    it("says when the program has no exam to wait for", async () => {
      const user = userEvent.setup();
      render(
        <UnlockRuleDialog
          candidates={GROUPS}
          exams={[]}
          mode="none"
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          open
          requiredIds={[]}
          subjectTitle="Músculos"
        />
      );

      await user.click(
        screen.getByRole("radio", { name: i18n.t("unlockModeExam") })
      );

      expect(
        screen.getByText(i18n.t("unlockNoExamsMessage"))
      ).toBeInTheDocument();
    });
  });

  describe("an exam's rule (exam-locks.md AC-5)", () => {
    function renderExamDialog(mode = "none", requiredIds: string[] = []) {
      const onSave = vi.fn();
      render(
        <UnlockRuleDialog
          candidates={[
            { items: [{ id: "m1", title: "Fundamentos" }], label: null },
          ]}
          exams={[{ id: "e2", title: "Prova 2" }]}
          mode={mode}
          modes={["none", "sources", "all", "any", "exam"]}
          onOpenChange={vi.fn()}
          onSave={onSave}
          open
          requiredIds={requiredIds}
          subjectTitle="Prova 1"
        />
      );
      return { onSave };
    }

    it("offers its own modes, without 'everything before it'", () => {
      renderExamDialog();

      expect(
        screen.getByRole("radio", { name: i18n.t("unlockModeSources") })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("radio", { name: i18n.t("unlockModePrevious") })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: i18n.t("unlockModeExam") })
      ).toBeInTheDocument();
    });

    it("saves 'after its own modules' with no list", async () => {
      const user = userEvent.setup();
      const { onSave } = renderExamDialog();

      await user.click(
        screen.getByRole("radio", { name: i18n.t("unlockModeSources") })
      );
      await user.click(
        screen.getByRole("button", { name: i18n.t("saveAction") })
      );

      expect(onSave).toHaveBeenCalledWith("sources", []);
    });

    it("opens on the saved rule", () => {
      renderExamDialog("sources");

      expect(
        screen.getByRole("radio", { name: i18n.t("unlockModeSources") })
      ).toBeChecked();
    });
  });
});
