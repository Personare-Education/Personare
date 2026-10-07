import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExamsDataTable, { type Exam } from "@/components/exams-data-table";
import "@/localization/i18n";

const EXAM_1 = /Prova 1/;
const EXAM_2 = /Prova 2/;
const STANDALONE = /avulsa/;

/**
 * RED phase (docs/specs/exams.md §2 AC-2): the program's exams, with where
 * their questions come from, how many, the time and the best score.
 */

const MODULE_NAMES = { a: "Anatomia", b: "Fisiologia" };

const EXAMS: Exam[] = [
  {
    availableCount: 10,
    bestScore: 0.82,
    id: "e1",
    lastAttemptAt: new Date("2026-10-01"),
    moduleIds: ["a", "b"],
    passed: true,
    passingScore: 70,
    questionCount: 20,
    standaloneCount: 3,
    timeLimitMinutes: 30,
    title: "Prova 1",
  },
  {
    availableCount: 10,
    bestScore: null,
    id: "e2",
    lastAttemptAt: null,
    moduleIds: ["a"],
    passed: false,
    passingScore: 70,
    questionCount: 10,
    standaloneCount: 0,
    timeLimitMinutes: null,
    title: "Prova 2",
  },
];

function renderTable() {
  const handlers = {
    onEdit: vi.fn(),
    onEditQuestions: vi.fn(),
    onHistory: vi.fn(),
    onRequestDelete: vi.fn(),
    onTake: vi.fn(),
  };
  render(
    <ExamsDataTable exams={EXAMS} moduleNames={MODULE_NAMES} {...handlers} />
  );
  return handlers;
}

describe("ExamsDataTable (exams.md §2 AC-2)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("shows each exam's sources, count, time and best score", () => {
    renderTable();

    const first = screen.getByRole("row", { name: EXAM_1 });
    expect(within(first).getByText("Anatomia, Fisiologia")).toBeInTheDocument();
    expect(within(first).getByText("+ 3 avulsas")).toBeInTheDocument();
    expect(within(first).getByText("20 perguntas")).toBeInTheDocument();
    expect(within(first).getByText("30 min")).toBeInTheDocument();
    expect(within(first).getByText("820 · Aprovada")).toBeInTheDocument();

    const second = screen.getByRole("row", { name: EXAM_2 });
    expect(within(second).queryByText(STANDALONE)).not.toBeInTheDocument();
    expect(within(second).getByText("Sem limite")).toBeInTheDocument();
    expect(within(second).getByText("Ainda não feita")).toBeInTheDocument();
  });

  it("says when the best score did not pass", () => {
    render(
      <ExamsDataTable
        exams={[{ ...EXAMS[0], bestScore: 0.5, passed: false }]}
        moduleNames={MODULE_NAMES}
        onEdit={vi.fn()}
        onEditQuestions={vi.fn()}
        onHistory={vi.fn()}
        onRequestDelete={vi.fn()}
        onTake={vi.fn()}
      />
    );

    expect(screen.getByText("500 · Não aprovada")).toBeInTheDocument();
  });

  it("edits, opens the standalone questions and asks to delete", async () => {
    const user = userEvent.setup();
    const handlers = renderTable();
    const row = screen.getByRole("row", { name: EXAM_1 });

    await user.click(
      within(row).getByRole("button", { name: i18n.t("moreActionsAction") })
    );
    await user.click(
      screen.getByRole("menuitem", { name: i18n.t("examQuestionsAction") })
    );
    expect(handlers.onEditQuestions).toHaveBeenCalledWith(EXAMS[0]);

    await user.click(
      within(row).getByRole("button", { name: i18n.t("moreActionsAction") })
    );
    await user.click(
      screen.getByRole("menuitem", { name: i18n.t("deleteExamAction") })
    );
    expect(handlers.onRequestDelete).toHaveBeenCalledWith(EXAMS[0]);

    await user.click(
      within(row).getByRole("button", { name: i18n.t("moreActionsAction") })
    );
    await user.click(
      screen.getByRole("menuitem", { name: i18n.t("editExamAction") })
    );
    expect(handlers.onEdit).toHaveBeenCalledWith(EXAMS[0]);
  });

  it("takes the exam as its main action, with the history in More actions (exams.md §3 AC-1, AC-7)", async () => {
    const user = userEvent.setup();
    const handlers = renderTable();
    const row = screen.getByRole("row", { name: EXAM_1 });

    await user.click(
      within(row).getByRole("button", { name: i18n.t("takeExamAction") })
    );
    expect(handlers.onTake).toHaveBeenCalledWith(EXAMS[0]);

    await user.click(
      within(row).getByRole("button", { name: i18n.t("moreActionsAction") })
    );
    await user.click(
      screen.getByRole("menuitem", { name: i18n.t("examHistoryAction") })
    );
    expect(handlers.onHistory).toHaveBeenCalledWith(EXAMS[0]);
  });

  it("cannot be taken with nothing to draw, and says why (exams.md §3 AC-1)", () => {
    render(
      <ExamsDataTable
        exams={[{ ...EXAMS[0], availableCount: 0 }]}
        moduleNames={MODULE_NAMES}
        onEdit={vi.fn()}
        onEditQuestions={vi.fn()}
        onHistory={vi.fn()}
        onRequestDelete={vi.fn()}
        onTake={vi.fn()}
      />
    );
    const row = screen.getByRole("row", { name: EXAM_1 });

    expect(
      within(row).queryByRole("button", { name: i18n.t("takeExamAction") })
    ).not.toBeInTheDocument();
    expect(
      within(row).getByText(i18n.t("examNothingToDrawLabel"))
    ).toBeInTheDocument();
  });
});
