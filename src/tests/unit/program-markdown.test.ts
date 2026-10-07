import { describe, expect, it } from "vitest";
import {
  buildProgramPrompt,
  parseProgramMarkdown,
} from "@/utils/program-markdown";

/**
 * RED phase (docs/specs/program-import.md, "1. Formato"): reading a whole
 * program from the Markdown an AI writes, and the prompt that asks for it.
 */

const EXAMPLE = `# Programa: Algoritmos

## Módulo: Fundamentos

### Link: Videoaula de complexidade
https://www.youtube.com/watch?v=abc

### Quiz: Fixação de complexidade
Qual a complexidade de busca binária?
- [x] O(log n)
- [ ] O(n)
- [ ] O(1)

Quanto vale $\\sum_{i=1}^{n} i$?
- [x] $\\frac{n(n+1)}{2}$
- [ ] $n^2$

### Flashcards: Termos
Frente: Big-O
Verso: Limite superior do crescimento de uma função.

Frente: Estável (ordenação)
Verso: Mantém a ordem relativa
de elementos iguais.

## Módulo: Arrays e Hashing
Libera depois de: Fundamentos

### Sequência: Revisão de hashing
Ordem: bloquear

#### Link: Apostila de hashing
https://exemplo.com/hashing.pdf

#### Quiz: Hashing na prática
O que é uma colisão?
- [x] Duas chaves no mesmo bucket
- [ ] Uma chave sem valor

## Prova: Prova 1
Módulos: Fundamentos; Arrays e Hashing
Perguntas: 10
Tempo: 30
Nota: 80
Libera depois de: módulos da prova

Pergunta avulsa: qual estrutura usa FIFO?
- [x] Fila
- [ ] Pilha
`;

const PROMPT_EXAMPLE = /```markdown\n([\s\S]*?)```/;

/** The 1-based line of the first line containing `text`. */
function lineOf(source: string, text: string): number {
  return source.split("\n").findIndex((line) => line.includes(text)) + 1;
}

describe("parseProgramMarkdown (program-import.md §1)", () => {
  it("reads a whole program, in file order, with no warnings (AC-1)", () => {
    const { program, warnings } = parseProgramMarkdown(EXAMPLE);

    expect(warnings).toEqual([]);
    expect(program?.name).toBe("Algoritmos");
    expect(program?.modules.map((module) => module.name)).toEqual([
      "Fundamentos",
      "Arrays e Hashing",
    ]);

    const [basics, hashing] = program?.modules ?? [];
    expect(basics.rule).toBeNull();
    expect(basics.activities.map((activity) => activity.type)).toEqual([
      "link",
      "quiz",
      "flashcards",
    ]);
    expect(basics.activities[0]).toMatchObject({
      title: "Videoaula de complexidade",
      url: "https://www.youtube.com/watch?v=abc",
    });
    expect(basics.activities[1]).toMatchObject({
      questions: [
        {
          options: [
            { isCorrect: true, text: "O(log n)" },
            { isCorrect: false, text: "O(n)" },
            { isCorrect: false, text: "O(1)" },
          ],
          text: "Qual a complexidade de busca binária?",
        },
        {
          options: [
            { isCorrect: true, text: "$\\frac{n(n+1)}{2}$" },
            { isCorrect: false, text: "$n^2$" },
          ],
          text: "Quanto vale $\\sum_{i=1}^{n} i$?",
        },
      ],
      title: "Fixação de complexidade",
    });
    expect(basics.activities[2]).toMatchObject({
      cards: [
        {
          back: "Limite superior do crescimento de uma função.",
          front: "Big-O",
        },
        {
          back: "Mantém a ordem relativa\nde elementos iguais.",
          front: "Estável (ordenação)",
        },
      ],
      title: "Termos",
    });

    expect(hashing.rule).toEqual({ mode: "all", names: ["Fundamentos"] });
    expect(hashing.activities).toHaveLength(1);
    expect(hashing.activities[0]).toMatchObject({
      order: "lock",
      title: "Revisão de hashing",
      type: "sequence",
    });
    const [sequence] = hashing.activities;
    expect(
      sequence.type === "sequence" &&
        sequence.steps.map((step) => [step.type, step.title])
    ).toEqual([
      ["link", "Apostila de hashing"],
      ["quiz", "Hashing na prática"],
    ]);

    expect(program?.exams).toEqual([
      expect.objectContaining({
        moduleNames: ["Fundamentos", "Arrays e Hashing"],
        passingScore: 80,
        questionCount: 10,
        questions: [
          {
            options: [
              { isCorrect: true, text: "Fila" },
              { isCorrect: false, text: "Pilha" },
            ],
            text: "Pergunta avulsa: qual estrutura usa FIFO?",
          },
        ],
        rule: { mode: "sources", names: [] },
        timeLimitMinutes: 30,
        title: "Prova 1",
      }),
    ]);
  });

  it("gives each block the line it starts on", () => {
    const { program } = parseProgramMarkdown(EXAMPLE);

    expect(program?.modules[1].line).toBe(lineOf(EXAMPLE, "## Módulo: Arrays"));
    expect(program?.exams[0].line).toBe(lineOf(EXAMPLE, "## Prova: Prova 1"));
  });

  describe("unlock rules (AC-4)", () => {
    const rule = (value: string, block = "Módulo") =>
      parseProgramMarkdown(
        `# Programa: P\n## ${block}: X\nLibera depois de: ${value}\n`
      );

    it("reads every kind of rule, by name", () => {
      expect(rule("anteriores").program?.modules[0].rule).toEqual({
        mode: "previous",
        names: [],
      });
      expect(rule("A; B").program?.modules[0].rule).toEqual({
        mode: "all",
        names: ["A", "B"],
      });
      expect(rule("qualquer um de: A; B").program?.modules[0].rule).toEqual({
        mode: "any",
        names: ["A", "B"],
      });
      expect(rule("passar na prova: Prova 1").program?.modules[0].rule).toEqual(
        { mode: "exam", names: ["Prova 1"] }
      );
      expect(
        rule("passar na prova: Prova 1", "Prova").program?.exams[0].rule
      ).toEqual({ mode: "exam", names: ["Prova 1"] });
    });

    it("refuses 'the exam's modules' on a module, which stays free", () => {
      const { program, warnings } = rule("módulos da prova");

      expect(program?.modules[0].rule).toBeNull();
      expect(warnings).toEqual([{ line: 3, reason: "invalidRule" }]);
    });

    it("refuses 'everything before it' on an exam, which stays free", () => {
      const { program, warnings } = rule("anteriores", "Prova");

      expect(program?.exams[0].rule).toBeNull();
      expect(warnings).toEqual([{ line: 3, reason: "invalidRule" }]);
    });
  });

  describe("what goes wrong (AC-1, AC-2)", () => {
    it("cannot import without a program heading", () => {
      const { program, warnings } = parseProgramMarkdown(
        "## Módulo: Solto\n### Link: X\nhttps://a.com\n"
      );

      expect(program).toBeNull();
      expect(warnings).toEqual([{ line: 1, reason: "missingProgram" }]);
    });

    it("leaves out a broken question, keeping the rest", () => {
      const source = `# Programa: P
## Módulo: M
### Quiz: Q
Sem certa?
- [ ] A
- [ ] B

Duas certas?
- [x] A
- [x] B

Uma só alternativa?
- [x] A

Boa?
- [x] Sim
- [ ] Não
`;
      const { program, warnings } = parseProgramMarkdown(source);
      const [quiz] = program?.modules[0].activities ?? [];

      expect(quiz.type === "quiz" && quiz.questions.map((q) => q.text)).toEqual(
        ["Boa?"]
      );
      expect(warnings).toEqual([
        { line: lineOf(source, "Sem certa?"), reason: "noCorrectOption" },
        {
          line: lineOf(source, "Duas certas?"),
          reason: "multipleCorrectOptions",
        },
        { line: lineOf(source, "Uma só"), reason: "tooFewOptions" },
      ]);
    });

    it("leaves out a quiz, a deck or a link with nothing valid in it", () => {
      const source = `# Programa: P
## Módulo: M
### Quiz: Vazio
Sem nada?
- [ ] A
### Flashcards: Sem verso
Frente: Só frente
### Link: Sem endereço
Um texto qualquer
`;
      const { program, warnings } = parseProgramMarkdown(source);

      expect(program?.modules[0].activities).toEqual([]);
      // In file order, as the preview lists them.
      expect(warnings).toEqual([
        { line: lineOf(source, "### Quiz: Vazio"), reason: "emptyActivity" },
        { line: lineOf(source, "Sem nada?"), reason: "tooFewOptions" },
        {
          line: lineOf(source, "### Flashcards: Sem verso"),
          reason: "emptyActivity",
        },
        { line: lineOf(source, "Frente: Só frente"), reason: "missingBack" },
        { line: lineOf(source, "### Link: Sem"), reason: "missingUrl" },
      ]);
    });

    it("leaves out unknown blocks, and what is not allowed in a sequence", () => {
      const source = `# Programa: P
## Coisa: X
### Link: Dentro de coisa
https://a.com
## Módulo: M
### PDF: Capítulo 1
### Sequência: S
#### Flashcards: Não cabe
Frente: A
Verso: B
#### Link: Cabe
https://b.com
`;
      const { program, warnings } = parseProgramMarkdown(source);

      expect(program?.modules.map((module) => module.name)).toEqual(["M"]);
      const [sequence] = program?.modules[0].activities ?? [];
      expect(
        sequence.type === "sequence" && sequence.steps.map((s) => s.title)
      ).toEqual(["Cabe"]);
      expect(warnings).toEqual([
        { line: 2, reason: "unknownBlock" },
        { line: 6, reason: "unknownBlock" },
        { line: 8, reason: "notInSequence" },
      ]);
    });
  });

  it("takes English keywords, in any case (AC-3)", () => {
    const { program, warnings } = parseProgramMarkdown(`# program: Algorithms
## MODULE: Basics
Unlocks after: any of: A; B
### Flashcards: Terms
Front: Big-O
Back: Upper bound
### Sequence: Review
Order: lock
#### Quiz: Check
Right?
- [x] Yes
- [ ] No
## Exam: Final
Modules: Basics
Questions: 5
Time: 20
Passing score: 60
Unlocks after: the exam's modules
`);

    expect(warnings).toEqual([]);
    expect(program?.name).toBe("Algorithms");
    expect(program?.modules[0].rule).toEqual({
      mode: "any",
      names: ["A", "B"],
    });
    expect(program?.modules[0].activities.map((a) => a.type)).toEqual([
      "flashcards",
      "sequence",
    ]);
    expect(program?.exams[0]).toMatchObject({
      moduleNames: ["Basics"],
      passingScore: 60,
      questionCount: 5,
      rule: { mode: "sources", names: [] },
      timeLimitMinutes: 20,
    });
  });

  it("keeps a # inside a code block as text (AC-3)", () => {
    const { program, warnings } = parseProgramMarkdown(`# Programa: P
## Módulo: M
### Quiz: Código
O que imprime?
\`\`\`python
# um comentário
print(1)
\`\`\`
- [x] 1
- [ ] Nada
`);

    expect(warnings).toEqual([]);
    const [quiz] = program?.modules[0].activities ?? [];
    expect(quiz.type === "quiz" && quiz.questions[0].text).toBe(
      "O que imprime?\n```python\n# um comentário\nprint(1)\n```"
    );
  });

  it("reads \\r\\n line endings (AC-3)", () => {
    const { program, warnings } = parseProgramMarkdown(
      EXAMPLE.replaceAll("\n", "\r\n")
    );

    expect(warnings).toEqual([]);
    expect(program?.modules).toHaveLength(2);
  });

  it("gives an exam 10 questions and 70% to pass by default, and no time limit", () => {
    const { program } = parseProgramMarkdown(
      "# Programa: P\n## Prova: P1\nMódulos: A\n"
    );

    expect(program?.exams[0]).toMatchObject({
      passingScore: 70,
      questionCount: 10,
      rule: null,
      timeLimitMinutes: null,
    });
  });

  it("reads an answer wrapped in a code block, or with chatter before it (AC-7)", () => {
    const wrapped = `Claro! Aqui está o seu programa:

\`\`\`markdown
${EXAMPLE}\`\`\`

Bons estudos!`;
    const { program, warnings } = parseProgramMarkdown(wrapped);

    expect(warnings).toEqual([]);
    expect(program?.modules).toHaveLength(2);
    expect(program?.exams).toHaveLength(1);
  });
});

describe("buildProgramPrompt (program-import.md §1 AC-5, AC-6)", () => {
  it("asks, in Portuguese, for only the file about the topic, with the rules", () => {
    const prompt = buildProgramPrompt({
      language: "pt-BR",
      topic: "Estruturas de dados",
    });

    expect(prompt).toContain("Estruturas de dados");
    expect(prompt).toContain("# Programa:");
    expect(prompt).toContain("Libera depois de:");
    expect(prompt).toContain("- [x]");
    expect(prompt).toContain("$");
  });

  it("asks in English, with the English keywords", () => {
    const prompt = buildProgramPrompt({ language: "en", topic: "Calculus" });

    expect(prompt).toContain("Calculus");
    expect(prompt).toContain("# Program:");
    expect(prompt).toContain("Unlocks after:");
  });

  it("adds the user's extra instructions", () => {
    const prompt = buildProgramPrompt({
      extraInstructions: "Foque em exercícios.",
      language: "pt-BR",
      topic: "Cálculo",
    });

    expect(prompt).toContain("Foque em exercícios.");
  });

  it.each(["pt-BR", "en"] as const)(
    "has an example (%s) that reads with no warnings",
    (language) => {
      const prompt = buildProgramPrompt({ language, topic: "X" });
      const example = PROMPT_EXAMPLE.exec(prompt)?.[1] ?? "";

      const { program, warnings } = parseProgramMarkdown(example);

      expect(example).not.toBe("");
      expect(warnings).toEqual([]);
      expect(program?.modules.length).toBeGreaterThan(0);
      expect(program?.exams.length).toBeGreaterThan(0);
    }
  );
});
