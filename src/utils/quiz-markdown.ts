/**
 * The Markdown quiz format a user brings back from an AI, and the prompt
 * that asks the AI for it (docs/specs/quiz-ai-import.md).
 */

export interface ParsedQuizOption {
  isCorrect: boolean;
  text: string;
}

export interface ParsedQuizQuestion {
  options: ParsedQuizOption[];
  text: string;
}

export type QuizMarkdownErrorReason =
  | "missingText"
  | "multipleCorrectOptions"
  | "noCorrectOption"
  | "tooFewOptions";

export interface QuizMarkdownError {
  /** 1-based position of the question in the file. */
  question: number;
  reason: QuizMarkdownErrorReason;
}

export interface ParsedQuiz {
  errors: QuizMarkdownError[];
  questions: ParsedQuizQuestion[];
}

export type QuizPromptLanguage = "en" | "pt-BR";

const QUESTION_HEADING = /^##\s/;
const OPTION_LINE = /^\s*[-*]\s+\[([ xX])\]\s+(.*\S)\s*$/;
const CODE_FENCE = /^\s*```/;
const LINE_BREAK = /\r?\n/;
const MIN_OPTIONS = 2;

function validate(
  question: ParsedQuizQuestion
): QuizMarkdownErrorReason | null {
  if (!question.text) {
    return "missingText";
  }
  if (question.options.length < MIN_OPTIONS) {
    return "tooFewOptions";
  }

  const correctCount = question.options.filter(
    (option) => option.isCorrect
  ).length;
  if (correctCount === 0) {
    return "noCorrectOption";
  }
  if (correctCount > 1) {
    return "multipleCorrectOptions";
  }
  return null;
}

/**
 * Each question starts at a `## ` heading (its text is ignored); the lines
 * up to its first `- [ ]`/`- [x]` item are the question text, and those items
 * are the options. Anything before the first heading and code fences are
 * skipped, since AIs tend to wrap the file in chatter and ``` blocks.
 */
export function parseQuizMarkdown(markdown: string): ParsedQuiz {
  const blocks: string[][] = [];

  for (const line of markdown.split(LINE_BREAK)) {
    if (CODE_FENCE.test(line)) {
      continue;
    }
    if (QUESTION_HEADING.test(line)) {
      blocks.push([]);
    } else {
      blocks.at(-1)?.push(line);
    }
  }

  const result: ParsedQuiz = { errors: [], questions: [] };

  blocks.forEach((lines, index) => {
    const textLines: string[] = [];
    const options: ParsedQuizOption[] = [];

    for (const line of lines) {
      const option = OPTION_LINE.exec(line);
      if (option) {
        options.push({ isCorrect: option[1] !== " ", text: option[2] });
      } else if (options.length === 0) {
        textLines.push(line);
      }
    }

    const question = { options, text: textLines.join("\n").trim() };
    const reason = validate(question);

    if (reason) {
      result.errors.push({ question: index + 1, reason });
    } else {
      result.questions.push(question);
    }
  });

  return result;
}

const PROMPTS: Record<QuizPromptLanguage, (theme: string) => string> = {
  en: (theme) => `Create a multiple-choice quiz about: "${theme}".

Reply ONLY with a Markdown (.md) file, with no text before or after it, following exactly this format:

\`\`\`markdown
## Question 1
The question statement, on one or more lines.

- [ ] Wrong answer
- [x] Right answer
- [ ] Wrong answer
- [ ] Wrong answer
\`\`\`

Rules:
- Write 10 questions.
- Each question starts with a "## Question N" line, followed by its statement.
- Each answer is a "- [ ]" list item; mark exactly ONE right answer per question with "- [x]".
- Use 3 to 5 answers per question.
- Write math in LaTeX, between $...$ (inline) or $$...$$ (block).
- Provide the result as a downloadable file named quiz.md. If you cannot create files, put the whole quiz in a single markdown code block.`,
  "pt-BR": (
    theme
  ) => `Crie um quiz de múltipla escolha sobre o tema: "${theme}".

Responda SOMENTE com um arquivo Markdown (.md), sem nenhum texto antes ou depois, seguindo exatamente este formato:

\`\`\`markdown
## Pergunta 1
O enunciado da pergunta, em uma ou mais linhas.

- [ ] Alternativa incorreta
- [x] Alternativa correta
- [ ] Alternativa incorreta
- [ ] Alternativa incorreta
\`\`\`

Regras:
- Escreva 10 perguntas.
- Cada pergunta começa com uma linha "## Pergunta N", seguida do enunciado.
- Cada alternativa é um item de lista "- [ ]"; marque exatamente UMA alternativa correta por pergunta com "- [x]".
- Use de 3 a 5 alternativas por pergunta.
- Escreva fórmulas matemáticas em LaTeX, entre $...$ (na linha) ou $$...$$ (em bloco).
- Entregue o resultado como um arquivo para download chamado quiz.md. Se não puder gerar arquivos, coloque o quiz inteiro em um único bloco de código markdown.`,
};

export function buildQuizPrompt(
  theme: string,
  language: QuizPromptLanguage
): string {
  return PROMPTS[language](theme.trim());
}
