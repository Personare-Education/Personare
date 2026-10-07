import { render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/** RED phase (docs/specs/exams.md §3 AC-7): an exam's past attempts. */

vi.mock("@/actions/exams", () => ({
  listExamAttempts: vi.fn(),
}));

const { listExamAttempts } = await import("@/actions/exams");
const { default: ExamAttemptsDialog } = await import(
  "@/components/exam-attempts-dialog"
);

describe("ExamAttemptsDialog (exams.md §3 AC-7)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("pt-BR");
  });

  it("lists each attempt's date, score, right answers and time", async () => {
    vi.mocked(listExamAttempts).mockResolvedValue([
      {
        correct: 9,
        durationMs: 125_000,
        examId: "e1",
        id: "t2",
        startedAt: new Date("2026-10-05T14:30:00"),
        total: 10,
      },
      {
        correct: 1,
        durationMs: 40_000,
        examId: "e1",
        id: "t1",
        startedAt: new Date("2026-10-01T09:00:00"),
        total: 4,
      },
    ]);
    render(
      <ExamAttemptsDialog
        exam={{ id: "e1", passingScore: 70, title: "Prova 1" }}
        onOpenChange={vi.fn()}
        open
      />
    );

    const rows = await screen.findAllByRole("row");
    // The header, then newest first.
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("900 · Aprovada")).toBeInTheDocument();
    expect(within(rows[1]).getByText("9 de 10")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2m 05s")).toBeInTheDocument();
    expect(within(rows[2]).getByText("250 · Não aprovada")).toBeInTheDocument();
    expect(listExamAttempts).toHaveBeenCalledWith("e1");
  });

  it("says when there are no attempts yet", async () => {
    vi.mocked(listExamAttempts).mockResolvedValue([]);
    render(
      <ExamAttemptsDialog
        exam={{ id: "e1", passingScore: 70, title: "Prova 1" }}
        onOpenChange={vi.fn()}
        open
      />
    );

    expect(
      await screen.findByText(i18n.t("examAttemptsEmptyMessage"))
    ).toBeInTheDocument();
  });
});
