import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExamFormDialog from "@/components/exam-form-dialog";
import type { Exam } from "@/components/exams-data-table";
import "@/localization/i18n";

const ANATOMY = /Anatomia/;
const PHYSIOLOGY = /Fisiologia/;
const BIOETHICS = /Bioética/;

/**
 * RED phase (docs/specs/exams.md §2 AC-3): an exam's title, modules (only
 * the ones with a quiz), how many questions to draw, the time limit and the
 * score to pass.
 */

const MODULES = [
  { id: "a", name: "Anatomia", questionCount: 12 },
  { id: "b", name: "Fisiologia", questionCount: 8 },
  { id: "c", name: "Bioética", questionCount: 0 },
];

function renderForm(exam: Exam | null = null) {
  const onSubmit = vi.fn();
  render(
    <ExamFormDialog
      exam={exam}
      modules={MODULES}
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
      open
    />
  );
  return { onSubmit };
}

describe("ExamFormDialog (exams.md §2 AC-3)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("lists the modules with their quiz questions, and turns off the ones without a quiz", () => {
    renderForm();

    expect(screen.getByRole("checkbox", { name: ANATOMY })).toBeEnabled();
    expect(screen.getByText("12 perguntas")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: BIOETHICS })).toBeDisabled();
    expect(screen.getByText("Sem quiz")).toBeInTheDocument();
  });

  it("needs a title and at least one module to save", async () => {
    const user = userEvent.setup();
    renderForm();
    const save = screen.getByRole("button", { name: i18n.t("saveAction") });

    expect(save).toBeDisabled();
    await user.type(
      screen.getByLabelText(i18n.t("examTitleLabel")),
      "Prova final"
    );
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: ANATOMY }));
    expect(save).toBeEnabled();
  });

  it("says how many questions the checked modules have", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("checkbox", { name: ANATOMY }));
    await user.click(screen.getByRole("checkbox", { name: PHYSIOLOGY }));

    expect(
      screen.getByText("20 perguntas nos módulos marcados")
    ).toBeInTheDocument();
  });

  it("submits the exam, with 70% to pass and no time limit by default", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(i18n.t("examTitleLabel")), "P1");
    await user.click(screen.getByRole("checkbox", { name: PHYSIOLOGY }));
    await user.click(screen.getByRole("checkbox", { name: ANATOMY }));
    const count = screen.getByLabelText(i18n.t("examQuestionCountLabel"));
    await user.clear(count);
    await user.type(count, "15");
    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(onSubmit).toHaveBeenCalledWith({
      moduleIds: ["a", "b"],
      passingScore: 70,
      questionCount: 15,
      timeLimitMinutes: null,
      title: "P1",
    });
  });

  it("takes a time limit and a passing score", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(i18n.t("examTitleLabel")), "P1");
    await user.click(screen.getByRole("checkbox", { name: ANATOMY }));
    await user.type(screen.getByLabelText(i18n.t("examTimeLimitLabel")), "45");
    const score = screen.getByLabelText(i18n.t("examPassingScoreLabel"));
    await user.clear(score);
    await user.type(score, "60");
    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ passingScore: 60, timeLimitMinutes: 45 })
    );
  });

  it("opens an exam with its saved values", () => {
    renderForm({
      bestScore: null,
      id: "e1",
      lastAttemptAt: null,
      moduleIds: ["b"],
      passed: false,
      passingScore: 80,
      questionCount: 5,
      standaloneCount: 0,
      timeLimitMinutes: 20,
      title: "Prova 1",
    });

    expect(screen.getByLabelText(i18n.t("examTitleLabel"))).toHaveValue(
      "Prova 1"
    );
    expect(screen.getByRole("checkbox", { name: PHYSIOLOGY })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: ANATOMY })).not.toBeChecked();
    expect(screen.getByLabelText(i18n.t("examQuestionCountLabel"))).toHaveValue(
      "5"
    );
    expect(screen.getByLabelText(i18n.t("examTimeLimitLabel"))).toHaveValue(
      "20"
    );
    expect(screen.getByLabelText(i18n.t("examPassingScoreLabel"))).toHaveValue(
      "80"
    );
  });

  it("has number fields without the browser's arrows, in the app's style", () => {
    renderForm();

    for (const key of [
      "examQuestionCountLabel",
      "examPassingScoreLabel",
      "examTimeLimitLabel",
    ]) {
      const input = screen.getByLabelText(i18n.t(key));
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("inputmode", "numeric");
    }
  });
});
