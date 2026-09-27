import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openExternalLink } from "@/actions/shell";
import QuizImportPanel from "@/components/quiz-import-panel";
import { buildQuizPrompt } from "@/utils/quiz-markdown";
import "@/localization/i18n";

/*
 * Spec: docs/specs/quiz-ai-import.md, AC-3 -- the "Import" step: theme, AI
 * picker, prompt button, dropzone and preview.
 */

vi.mock("@/actions/shell", () => ({ openExternalLink: vi.fn() }));

const VALID_MARKDOWN = `## Pergunta 1
Quanto é 2 + 2?

- [ ] 3
- [x] 4

## Pergunta 2
Capital da França?

- [x] Paris
- [ ] Roma
`;

beforeAll(() => {
  // Radix Select relies on pointer capture and scrollIntoView, which jsdom lacks.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

function renderPanel() {
  const onParsedChange = vi.fn();
  render(<QuizImportPanel onParsedChange={onParsedChange} />);
  return { onParsedChange };
}

function mdFile(content: string, name = "quiz.md") {
  return new File([content], name, { type: "text/markdown" });
}

// userEvent.setup() installs its own clipboard stub, so tests read it back.
describe("QuizImportPanel", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
  });

  it("keeps the prompt button disabled until a theme is typed", async () => {
    const user = userEvent.setup();
    renderPanel();

    const button = screen.getByRole("button", {
      name: i18n.t("quizImportSendPromptAction", { ai: "ChatGPT" }),
    });
    expect(button).toBeDisabled();

    await user.type(
      screen.getByLabelText(i18n.t("quizImportThemeLabel")),
      "Photosynthesis"
    );
    expect(button).toBeEnabled();
  });

  it("copies the themed prompt and opens ChatGPT with it by default", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(
      screen.getByLabelText(i18n.t("quizImportThemeLabel")),
      "Photosynthesis"
    );
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("quizImportSendPromptAction", { ai: "ChatGPT" }),
      })
    );

    const prompt = buildQuizPrompt("Photosynthesis", "en");
    await waitFor(() => expect(openExternalLink).toHaveBeenCalled());
    expect(await navigator.clipboard.readText()).toBe(prompt);
    expect(openExternalLink).toHaveBeenCalledWith(
      `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`
    );
  });

  it("opens Claude with the prompt when Claude is picked", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(
      screen.getByLabelText(i18n.t("quizImportThemeLabel")),
      "Photosynthesis"
    );
    await user.click(
      screen.getByRole("combobox", { name: i18n.t("quizImportAiLabel") })
    );
    await user.click(await screen.findByRole("option", { name: "Claude" }));
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("quizImportSendPromptAction", { ai: "Claude" }),
      })
    );

    const prompt = buildQuizPrompt("Photosynthesis", "en");
    await waitFor(() =>
      expect(openExternalLink).toHaveBeenCalledWith(
        `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
      )
    );
  });

  it("opens Gemini without the prompt and tells the user to paste it", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(
      screen.getByLabelText(i18n.t("quizImportThemeLabel")),
      "Photosynthesis"
    );
    await user.click(
      screen.getByRole("combobox", { name: i18n.t("quizImportAiLabel") })
    );
    await user.click(await screen.findByRole("option", { name: "Gemini" }));
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("quizImportSendPromptAction", { ai: "Gemini" }),
      })
    );

    await waitFor(() =>
      expect(openExternalLink).toHaveBeenCalledWith(
        "https://gemini.google.com/app"
      )
    );
    expect(await navigator.clipboard.readText()).toBe(
      buildQuizPrompt("Photosynthesis", "en")
    );
    expect(
      screen.getByText(i18n.t("quizImportPromptCopiedPaste", { ai: "Gemini" }))
    ).toBeInTheDocument();
  });

  it("writes the prompt in the app's language", async () => {
    await i18n.changeLanguage("pt-BR");
    const user = userEvent.setup();
    renderPanel();

    await user.type(
      screen.getByLabelText(i18n.t("quizImportThemeLabel")),
      "Fotossíntese"
    );
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("quizImportSendPromptAction", { ai: "ChatGPT" }),
      })
    );

    await waitFor(() => expect(openExternalLink).toHaveBeenCalled());
    expect(await navigator.clipboard.readText()).toBe(
      buildQuizPrompt("Fotossíntese", "pt-BR")
    );
  });

  it("previews the questions read from a chosen .md file and reports them", async () => {
    const user = userEvent.setup();
    const { onParsedChange } = renderPanel();

    await user.upload(
      screen.getByLabelText(i18n.t("quizImportDropzoneLabel")),
      mdFile(VALID_MARKDOWN)
    );

    expect(
      await screen.findByText(i18n.t("quizImportPreviewCount", { count: 2 }))
    ).toBeInTheDocument();
    expect(screen.getByText("Quanto é 2 + 2?")).toBeInTheDocument();
    expect(screen.getByText("Capital da França?")).toBeInTheDocument();
    expect(onParsedChange).toHaveBeenLastCalledWith([
      {
        options: [
          { isCorrect: false, text: "3" },
          { isCorrect: true, text: "4" },
        ],
        text: "Quanto é 2 + 2?",
      },
      {
        options: [
          { isCorrect: true, text: "Paris" },
          { isCorrect: false, text: "Roma" },
        ],
        text: "Capital da França?",
      },
    ]);
  });

  it("lists format errors per question, next to the valid ones", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.upload(
      screen.getByLabelText(i18n.t("quizImportDropzoneLabel")),
      mdFile(`${VALID_MARKDOWN}\n## 3\nSem correta\n\n- [ ] a\n- [ ] b\n`)
    );

    expect(
      await screen.findByText(
        i18n.t("quizImportErrorNoCorrectOption", { question: 3 })
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("quizImportPreviewCount", { count: 2 }))
    ).toBeInTheDocument();
  });

  it("says so when the file has no questions", async () => {
    const user = userEvent.setup();
    const { onParsedChange } = renderPanel();

    await user.upload(
      screen.getByLabelText(i18n.t("quizImportDropzoneLabel")),
      mdFile("nada aqui")
    );

    expect(
      await screen.findByText(i18n.t("quizImportEmptyFileMessage"))
    ).toBeInTheDocument();
    expect(onParsedChange).toHaveBeenLastCalledWith([]);
  });
});
