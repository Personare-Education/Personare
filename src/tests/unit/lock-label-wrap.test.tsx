import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivitiesDataTable, {
  type Activity,
} from "@/components/activities-data-table";
import ModulesDataTable, { type Module } from "@/components/modules-data-table";
import "@/localization/i18n";

vi.mock("@/actions/shell", () => ({ openExternalLink: vi.fn() }));

/**
 * RED phase (docs/specs/lock-label-wrap.md AC-1): a long padlock label goes
 * to the next line, as in the exams table, instead of widening the table
 * and pushing the actions off it. jsdom has no layout, so this checks the
 * cell can wrap; docs/specs/lock-label-wrap.md AC-2 was measured in a browser.
 */

const LONG_LOCK =
  "Libera depois de Funções e Limites, Derivadas: Definição e Regras Básicas, Regra da Cadeia, Derivação Implícita, Exponenciais e Logaritmos e Aplicações da Derivada";
const NOW = new Date("2026-10-08");
const noop = () => undefined;

/** The table cell holding a row's name, and the line inside it. */
function nameCellOf(name: string) {
  const line = screen.getByText(name).closest("span");
  const cell = line?.closest("td");
  if (!(line && cell)) {
    throw new Error(`no name cell for ${name}`);
  }
  return { cell, line };
}

describe("a long padlock label wraps (AC-1)", () => {
  it("in the modules table", () => {
    const module: Module = {
      createdAt: NOW,
      id: "m1",
      name: "Aplicações da Integral",
      programId: "p1",
      updatedAt: NOW,
    };
    render(
      <ModulesDataTable
        lockLabelById={{ m1: LONG_LOCK }}
        modules={[module]}
        onEdit={noop}
        onNavigateToActivities={noop}
        onRequestDelete={noop}
      />
    );

    const { cell, line } = nameCellOf("Aplicações da Integral");
    expect(cell).toHaveClass("whitespace-normal");
    expect(line).toHaveClass("flex-wrap");
  });

  it("in the activities table", () => {
    const activity: Activity = {
      createdAt: NOW,
      filePath: null,
      id: "a1",
      moduleId: "m1",
      title: "Quiz de integrais",
      type: "quiz",
      updatedAt: NOW,
      url: null,
    };
    render(
      <ActivitiesDataTable
        activities={[activity]}
        lockLabelById={{ a1: LONG_LOCK }}
        onEdit={noop}
        onManageFlashcards={noop}
        onManageQuiz={noop}
        onOpenLink={noop}
        onRequestDelete={noop}
        onStartReview={noop}
        onTakeQuiz={noop}
        onViewPdf={noop}
        reviewStateByActivityId={{}}
      />
    );

    const { cell, line } = nameCellOf("Quiz de integrais");
    expect(cell).toHaveClass("whitespace-normal");
    expect(line).toHaveClass("flex-wrap");
  });
});
