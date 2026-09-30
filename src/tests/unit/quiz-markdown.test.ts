import { describe, expect, it } from "vitest";
import { buildQuizPrompt, parseQuizMarkdown } from "@/utils/quiz-markdown";

/*
 * Spec: docs/specs/quiz-ai-import.md -- the Markdown a user brings back from
 * an AI, and the prompt that tells the AI to write it.
 */

const TWO_QUESTIONS = `## Pergunta 1
Quanto é 2 + 2?

- [ ] 3
- [x] 4
- [ ] 5

## Pergunta 2
Qual a derivada de $x^2$?
Escolha a alternativa correta.

* [ ] $x$
* [X] $2x$
`;

describe("parseQuizMarkdown", () => {
  it("reads each question's text and options, in file order", () => {
    const { errors, questions } = parseQuizMarkdown(TWO_QUESTIONS);

    expect(errors).toEqual([]);
    expect(questions).toEqual([
      {
        options: [
          { isCorrect: false, text: "3" },
          { isCorrect: true, text: "4" },
          { isCorrect: false, text: "5" },
        ],
        text: "Quanto é 2 + 2?",
      },
      {
        options: [
          { isCorrect: false, text: "$x$" },
          { isCorrect: true, text: "$2x$" },
        ],
        text: "Qual a derivada de $x^2$?\nEscolha a alternativa correta.",
      },
    ]);
  });

  it("ignores chatter before the first question and code fences around the file", () => {
    const wrapped = `Claro! Aqui está o seu quiz:\n\n\`\`\`markdown\n${TWO_QUESTIONS}\`\`\`\n`;

    const { errors, questions } = parseQuizMarkdown(wrapped);

    expect(errors).toEqual([]);
    expect(questions).toHaveLength(2);
  });

  it("keeps a code block inside the question text", () => {
    const code = "```c\nint x = 1;\nif (x) {\n    x++;\n}\n```";
    const markdown = `\`\`\`\n## Pergunta 1\nConsidere o código:\n${code}\n\nQual o valor?\n\n- [ ] 1\n- [x] 2\n`;

    const { errors, questions } = parseQuizMarkdown(markdown);

    expect(errors).toEqual([]);
    expect(questions[0].text).toBe(
      `Considere o código:\n${code}\n\nQual o valor?`
    );
  });

  it("accepts Windows line endings", () => {
    const { questions } = parseQuizMarkdown(
      TWO_QUESTIONS.replace(/\n/g, "\r\n")
    );

    expect(questions[0].options[1]).toEqual({ isCorrect: true, text: "4" });
  });

  it("reports invalid questions by number and keeps the valid ones", () => {
    const markdown = `## 1
Sem alternativa correta

- [ ] a
- [ ] b

## 2
Válida

- [x] a
- [ ] b

## 3
Duas corretas

- [x] a
- [x] b

## 4

- [x] a
- [ ] b

## 5
Só uma alternativa

- [x] a
`;

    const { errors, questions } = parseQuizMarkdown(markdown);

    expect(questions.map((question) => question.text)).toEqual(["Válida"]);
    expect(errors).toEqual([
      { question: 1, reason: "noCorrectOption" },
      { question: 3, reason: "multipleCorrectOptions" },
      { question: 4, reason: "missingText" },
      { question: 5, reason: "tooFewOptions" },
    ]);
  });

  it("returns nothing for a file with no questions", () => {
    expect(parseQuizMarkdown("apenas texto solto")).toEqual({
      errors: [],
      questions: [],
    });
  });
});

describe("buildQuizPrompt", () => {
  it("asks for the user's theme in the documented Markdown format", () => {
    const prompt = buildQuizPrompt("Revolução Francesa", "pt-BR");

    expect(prompt).toContain("Revolução Francesa");
    expect(prompt).toContain("## Pergunta 1");
    expect(prompt).toContain("- [x]");
    expect(prompt).toContain("- [ ]");
  });

  it("writes the prompt in English for the English UI", () => {
    const prompt = buildQuizPrompt("Photosynthesis", "en");

    expect(prompt).toContain("Photosynthesis");
    expect(prompt).toContain("## Question 1");
  });

  it("produces a prompt whose own example parses as a valid quiz", () => {
    for (const language of ["en", "pt-BR"] as const) {
      const prompt = buildQuizPrompt("Tema", language);
      const start = prompt.indexOf("```markdown\n") + "```markdown\n".length;
      const example = prompt.slice(start, prompt.indexOf("```", start));

      expect(parseQuizMarkdown(example).errors).toEqual([]);
      expect(parseQuizMarkdown(example).questions).toHaveLength(1);
    }
  });
});
