import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (docs/specs/program-import.md §3 AC-2, AC-4): the dialog that
 * sends the prompt to an AI, takes the file back and previews the import.
 */

vi.mock("@/actions/programs", () => ({
  importProgram: vi.fn(),
  previewProgramImport: vi.fn(),
}));
vi.mock("@/actions/shell", () => ({ openExternalLink: vi.fn() }));

const { importProgram, previewProgramImport } = await import(
  "@/actions/programs"
);
const { openExternalLink } = await import("@/actions/shell");
const { default: ProgramImportDialog } = await import(
  "@/components/program-import-dialog"
);

const FILE = "# Programa: Algoritmos\n## Módulo: Fundamentos\n";
const RULE_ISSUE = /Libera depois de: Fantasma/;
const ITEM_COLLISIONS = /Colisões/;
const ITEM_FUNDAMENTOS = /Fundamentos/;
const ITEM_HASHING = /Hashing/;
const ITEM_PROVA_1 = /Prova 1/;
const ITEM_PROVA_ANTIGA = /Prova antiga/;
const ITEM_TERMOS = /Termos/;

const REPORT = {
  created: { activityIds: [], examIds: [], moduleIds: [], programId: "p1" },
  exams: [
    {
      droppedModules: ["Sem quiz"],
      line: 30,
      rule: { mode: "sources", names: [] },
      skipped: false,
      title: "Prova 1",
    },
    {
      droppedModules: [],
      line: 40,
      reason: "exists",
      rule: null,
      skipped: true,
      title: "Prova antiga",
    },
  ],
  modules: [
    {
      activities: [
        { count: 0, skipped: false, title: "Videoaula", type: "link" },
        { count: 2, skipped: false, title: "Fixação", type: "quiz" },
        { count: 3, skipped: true, title: "Termos", type: "flashcards" },
        {
          count: 2,
          skipped: false,
          steps: [
            { count: 0, skipped: false, title: "Apostila", type: "link" },
            { count: 1, skipped: false, title: "Colisões", type: "quiz" },
          ],
          title: "Revisão",
          type: "sequence",
        },
      ],
      existed: true,
      line: 3,
      name: "Fundamentos",
      rule: null,
    },
    {
      activities: [],
      existed: false,
      line: 20,
      name: "Hashing",
      rule: { mode: "all", names: ["Fantasma"] },
      ruleIssue: "unknownName",
    },
  ],
  programExisted: true,
  programId: "p1",
  programName: "Algoritmos",
  warnings: [{ line: 12, reason: "noCorrectOption" }],
};

function renderDialog() {
  const onImported = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ProgramImportDialog
      onImported={onImported}
      onOpenChange={onOpenChange}
      open
    />
  );
  return { onImported, onOpenChange };
}

async function pasteFile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: i18n.t("programImportHaveFileAction") })
  );
  const pasted = screen.getByLabelText(i18n.t("programImportPasteLabel"));
  await user.click(pasted);
  await user.paste(FILE);
  await user.click(
    screen.getByRole("button", { name: i18n.t("programImportPreviewAction") })
  );
}

describe("ProgramImportDialog (program-import.md §3)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("pt-BR");
    vi.mocked(previewProgramImport).mockResolvedValue(REPORT as never);
    vi.mocked(importProgram).mockResolvedValue(REPORT as never);
  });

  it("copies the prompt about the topic and opens the AI (AC-2.1)", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDialog();

    const send = screen.getByRole("button", {
      name: i18n.t("quizImportSendPromptAction", { ai: "ChatGPT" }),
    });
    expect(send).toBeDisabled();
    await user.type(
      screen.getByLabelText(i18n.t("programImportTopicLabel")),
      "Estruturas de dados"
    );
    await user.click(send);

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Estruturas de dados")
    );
    expect(openExternalLink).toHaveBeenCalledWith(
      expect.stringContaining("https://chatgpt.com/?q=")
    );
  });

  it("previews the pasted file as a tree: new or existing, what is left out, and why (AC-2.3)", async () => {
    const user = userEvent.setup();
    renderDialog();

    await pasteFile(user);

    expect(previewProgramImport).toHaveBeenCalledWith(FILE);
    expect(
      await screen.findByText(
        i18n.t("programImportCompletes", { name: "Algoritmos" })
      )
    ).toBeInTheDocument();

    const basics = screen.getByRole("listitem", { name: ITEM_FUNDAMENTOS });
    expect(
      within(basics).getByText(i18n.t("programImportExisting"))
    ).toBeInTheDocument();
    expect(within(basics).getByText("2 perguntas")).toBeInTheDocument();
    const deck = within(basics).getByRole("listitem", { name: ITEM_TERMOS });
    expect(
      within(deck).getByText(i18n.t("programImportAlreadyThere"))
    ).toBeInTheDocument();
    expect(
      within(basics).getByRole("listitem", { name: ITEM_COLLISIONS })
    ).toBeInTheDocument();

    const hashing = screen.getByRole("listitem", { name: ITEM_HASHING });
    expect(within(hashing).getByText(RULE_ISSUE)).toBeInTheDocument();
    expect(
      within(hashing).getByText(i18n.t("programImportRuleUnknownName"))
    ).toBeInTheDocument();

    const exam = screen.getByRole("listitem", { name: ITEM_PROVA_1 });
    expect(
      within(exam).getByText(
        i18n.t("programImportDroppedModules", { names: "Sem quiz" })
      )
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("listitem", { name: ITEM_PROVA_ANTIGA })
      ).getByText(i18n.t("programImportAlreadyThere"))
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        i18n.t("programImportWarningNoCorrectOption", { line: 12 })
      )
    ).toBeInTheDocument();
  });

  it("imports the file and hands back the report (AC-2.3, AC-3)", async () => {
    const user = userEvent.setup();
    const { onImported } = renderDialog();

    await pasteFile(user);
    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("programImportAction"),
      })
    );

    await waitFor(() => expect(importProgram).toHaveBeenCalledWith(FILE));
    expect(onImported).toHaveBeenCalledWith(REPORT);
  });

  it("explains a file without a program heading and offers the prompt again (AC-4)", async () => {
    const user = userEvent.setup();
    vi.mocked(previewProgramImport).mockRejectedValue(new Error("no program"));
    renderDialog();

    await pasteFile(user);

    expect(
      await screen.findByText(i18n.t("programImportMissingProgram"))
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("programImportAction") })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("programImportBackToPromptAction"),
      })
    );
    expect(
      screen.getByLabelText(i18n.t("programImportTopicLabel"))
    ).toBeInTheDocument();
  });
});
