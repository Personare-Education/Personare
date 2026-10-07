/**
 * A whole program in the Markdown an AI writes, and the prompt that asks
 * for it (docs/specs/program-import.md §1). Pure: the IPC decides what is
 * new and saves it.
 */

import type {
  ParsedQuizOption,
  ParsedQuizQuestion,
} from "@/utils/quiz-markdown";

export type ProgramWarningReason =
  | "emptyActivity"
  | "invalidRule"
  | "missingBack"
  | "missingProgram"
  | "missingText"
  | "missingUrl"
  | "multipleCorrectOptions"
  | "noCorrectOption"
  | "notInSequence"
  | "tooFewOptions"
  | "unknownBlock";

export interface ProgramWarning {
  /** 1-based line in the file. */
  line: number;
  reason: ProgramWarningReason;
}

/** An unlock rule, still by name (§1 AC-4). */
export interface ParsedRule {
  mode: "all" | "any" | "exam" | "previous" | "sources";
  names: string[];
}

export interface ParsedLink {
  line: number;
  title: string;
  type: "link";
  url: string;
}

export interface ParsedQuiz {
  line: number;
  questions: ParsedQuizQuestion[];
  title: string;
  type: "quiz";
}

export interface ParsedFlashcards {
  cards: { back: string; front: string }[];
  line: number;
  title: string;
  type: "flashcards";
}

export interface ParsedSequence {
  line: number;
  /** "lock": each step waits for the ones before it. */
  order: "lock" | "suggest";
  steps: (ParsedLink | ParsedQuiz)[];
  title: string;
  type: "sequence";
}

export type ParsedActivity =
  | ParsedFlashcards
  | ParsedLink
  | ParsedQuiz
  | ParsedSequence;

export interface ParsedModule {
  activities: ParsedActivity[];
  line: number;
  name: string;
  rule: ParsedRule | null;
}

export interface ParsedExam {
  line: number;
  moduleNames: string[];
  passingScore: number;
  questionCount: number;
  /** Its standalone questions. */
  questions: ParsedQuizQuestion[];
  rule: ParsedRule | null;
  timeLimitMinutes: number | null;
  title: string;
}

export interface ParsedProgram {
  exams: ParsedExam[];
  modules: ParsedModule[];
  name: string;
}

export interface ParsedProgramFile {
  /** Null when there is no program heading: nothing to import. */
  program: ParsedProgram | null;
  warnings: ProgramWarning[];
}

const LINE_BREAK = /\r?\n/;
const HEADING = /^(#{1,6})\s+(.*\S)\s*$/;
const CODE_FENCE = /^\s*```/;
const OPENING_FENCE = /^\s*```\s*(markdown|md)?\s*$/i;
const OPTION_LINE = /^\s*[-*]\s+\[([ xX])\]\s+(.*\S)\s*$/;
const URL = /https?:\/\/\S+/;
const KEY_LINE = /^\s*([^:]{1,40}):\s*(.*?)\s*$/;
const DIGITS = /^\d+$/;
const LIST_SEPARATOR = /\s*;\s*/;
const DIACRITICS = /\p{Diacritic}/gu;
const MIN_OPTIONS = 2;
const DEFAULT_QUESTION_COUNT = 10;
const DEFAULT_PASSING_SCORE = 70;

/** Lowercase, without accents: "Módulo" and "modulo" are the same word. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS, "").trim().toLowerCase();
}

const KEYWORDS = {
  any: ["qualquer um de", "any of"],
  back: ["verso", "back"],
  exam: ["prova", "exam"],
  examRule: ["passar na prova", "passing the exam", "passing exam"],
  flashcards: ["flashcards", "flashcard", "cartoes"],
  front: ["frente", "front"],
  link: ["link"],
  module: ["modulo", "module"],
  modules: ["modulos", "modules"],
  order: ["ordem", "order"],
  orderLock: ["bloquear", "lock"],
  passingScore: ["nota", "passing score", "score"],
  previous: ["anteriores", "previous"],
  program: ["programa", "program"],
  questions: ["perguntas", "questions"],
  quiz: ["quiz"],
  rule: ["libera depois de", "unlocks after"],
  sequence: ["sequencia", "sequence"],
  sources: ["modulos da prova", "the exam's modules", "its modules"],
  time: ["tempo", "time"],
} as const;

function is(word: string, keyword: keyof typeof KEYWORDS): boolean {
  return (KEYWORDS[keyword] as readonly string[]).includes(normalize(word));
}

/** "Kind: Title" in a heading; no colon, just a title. */
function splitHeading(text: string): { kind: string; title: string } {
  const colon = text.indexOf(":");
  return colon === -1
    ? { kind: "", title: text.trim() }
    : {
        kind: text.slice(0, colon).trim(),
        title: text.slice(colon + 1).trim(),
      };
}

interface Line {
  number: number;
  text: string;
}

interface Block {
  body: Line[];
  children: Block[];
  kind: string;
  level: number;
  line: number;
  title: string;
}

/**
 * Chats tend to wrap the answer in one ```markdown block, with words before
 * and after it (§1 AC-7): that block is the file.
 */
function unwrap(lines: Line[]): Line[] {
  const opening = lines.findIndex((line) => OPENING_FENCE.test(line.text));
  const firstHeading = lines.findIndex((line) => HEADING.test(line.text));
  if (opening === -1 || (firstHeading !== -1 && firstHeading < opening)) {
    return lines;
  }
  let closing = -1;
  for (let index = lines.length - 1; index > opening; index -= 1) {
    if (CODE_FENCE.test(lines[index].text)) {
      closing = index;
      break;
    }
  }
  return closing === -1 ? lines : lines.slice(opening + 1, closing);
}

/** Headings outside code blocks open blocks; the rest is their body. */
function toBlocks(lines: Line[]): Block[] {
  const roots: Block[] = [];
  const open: Block[] = [];
  let inCode = false;

  for (const line of lines) {
    const heading = inCode ? null : HEADING.exec(line.text);
    if (CODE_FENCE.test(line.text)) {
      inCode = !inCode;
    }
    if (!heading) {
      open.at(-1)?.body.push(line);
      continue;
    }
    const level = heading[1].length;
    const block: Block = {
      body: [],
      children: [],
      level,
      line: line.number,
      ...splitHeading(heading[2]),
    };
    while ((open.at(-1)?.level ?? 0) >= level) {
      open.pop();
    }
    const parent = open.at(-1);
    if (parent) {
      parent.children.push(block);
    } else {
      roots.push(block);
    }
    open.push(block);
  }
  return roots;
}

function questionProblem(
  question: ParsedQuizQuestion
): ProgramWarningReason | null {
  if (!question.text) {
    return "missingText";
  }
  if (question.options.length < MIN_OPTIONS) {
    return "tooFewOptions";
  }
  const correct = question.options.filter((option) => option.isCorrect).length;
  if (correct === 0) {
    return "noCorrectOption";
  }
  return correct > 1 ? "multipleCorrectOptions" : null;
}

/**
 * Questions in a row: text (one or more lines, code blocks kept), then its
 * `- [x]` / `- [ ]` alternatives; the next text starts the next question.
 */
function parseQuestions(
  lines: Line[],
  warnings: ProgramWarning[]
): ParsedQuizQuestion[] {
  const drafts: {
    line: number;
    options: ParsedQuizOption[];
    text: string[];
  }[] = [];
  let inCode = false;

  for (const line of lines) {
    const current = drafts.at(-1);
    const fence = CODE_FENCE.test(line.text);
    const option = inCode || fence ? null : OPTION_LINE.exec(line.text);
    if (option) {
      current?.options.push({ isCorrect: option[1] !== " ", text: option[2] });
      continue;
    }
    if (fence) {
      inCode = !inCode;
    }
    const blank = line.text.trim() === "";
    if (!current || current.options.length > 0) {
      if (!blank) {
        drafts.push({ line: line.number, options: [], text: [line.text] });
      }
      continue;
    }
    current.text.push(line.text);
  }

  const questions: ParsedQuizQuestion[] = [];
  for (const draft of drafts) {
    const question = {
      options: draft.options,
      text: draft.text.join("\n").trim(),
    };
    const problem = questionProblem(question);
    if (problem) {
      warnings.push({ line: draft.line, reason: problem });
    } else {
      questions.push(question);
    }
  }
  return questions;
}

/** "Key: value" lines at the top of a body, and where the rest starts. */
function readKeys(
  lines: Line[],
  accepts: (key: string) => boolean
): { keys: Map<string, Line & { value: string }>; rest: Line[] } {
  const keys = new Map<string, Line & { value: string }>();
  let index = 0;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.text.trim() === "") {
      continue;
    }
    const match = KEY_LINE.exec(line.text);
    if (!(match && accepts(match[1]))) {
      break;
    }
    keys.set(normalize(match[1]), { ...line, value: match[2] });
  }
  return { keys, rest: lines.slice(index) };
}

function keyValue(
  keys: Map<string, Line & { value: string }>,
  keyword: keyof typeof KEYWORDS
): (Line & { value: string }) | undefined {
  return (KEYWORDS[keyword] as readonly string[])
    .map((word) => keys.get(word))
    .find((value) => value !== undefined);
}

function names(text: string): string[] {
  return text
    .split(LIST_SEPARATOR)
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

/** "after something: names" -> the names, when it starts with that. */
function afterPrefix(
  value: string,
  keyword: keyof typeof KEYWORDS
): string | null {
  const colon = value.indexOf(":");
  return colon !== -1 && is(value.slice(0, colon), keyword)
    ? value.slice(colon + 1)
    : null;
}

/**
 * A rule's text (§1 AC-4): everything before (modules), the exam's own
 * modules (exams), any of, passing an exam, or a list -- all of these.
 */
function parseRule(
  value: string,
  subject: "exam" | "module"
): ParsedRule | null {
  if (is(value, "previous")) {
    return subject === "module" ? { mode: "previous", names: [] } : null;
  }
  if (is(value, "sources")) {
    return subject === "exam" ? { mode: "sources", names: [] } : null;
  }
  const anyOf = afterPrefix(value, "any");
  if (anyOf !== null) {
    return names(anyOf).length > 0
      ? { mode: "any", names: names(anyOf) }
      : null;
  }
  const exam = afterPrefix(value, "examRule");
  if (exam !== null) {
    return names(exam).length === 1
      ? { mode: "exam", names: names(exam) }
      : null;
  }
  return names(value).length > 0 ? { mode: "all", names: names(value) } : null;
}

function readRule(
  key: (Line & { value: string }) | undefined,
  subject: "exam" | "module",
  warnings: ProgramWarning[]
): ParsedRule | null {
  if (!key) {
    return null;
  }
  const rule = parseRule(key.value, subject);
  if (!rule) {
    warnings.push({ line: key.number, reason: "invalidRule" });
  }
  return rule;
}

function parseLink(
  block: Block,
  warnings: ProgramWarning[]
): ParsedLink | null {
  const url = block.body
    .map((line) => URL.exec(line.text)?.[0])
    .find((found) => found !== undefined);
  if (!url) {
    warnings.push({ line: block.line, reason: "missingUrl" });
    return null;
  }
  return { line: block.line, title: block.title, type: "link", url };
}

function parseQuiz(
  block: Block,
  warnings: ProgramWarning[]
): ParsedQuiz | null {
  const questions = parseQuestions(block.body, warnings);
  if (questions.length === 0) {
    warnings.push({ line: block.line, reason: "emptyActivity" });
    return null;
  }
  return { line: block.line, questions, title: block.title, type: "quiz" };
}

/** Front/back pairs; the text may go on below until the next front. */
function parseFlashcards(
  block: Block,
  warnings: ProgramWarning[]
): ParsedFlashcards | null {
  const drafts: { back: string[] | null; front: string[]; line: number }[] = [];
  for (const line of block.body) {
    const match = KEY_LINE.exec(line.text);
    const current = drafts.at(-1);
    if (match && is(match[1], "front")) {
      drafts.push({ back: null, front: [match[2]], line: line.number });
    } else if (match && is(match[1], "back") && current) {
      current.back = [match[2]];
    } else if (current) {
      (current.back ?? current.front).push(line.text);
    }
  }
  const cards: { back: string; front: string }[] = [];
  for (const draft of drafts) {
    const front = draft.front.join("\n").trim();
    const back = draft.back?.join("\n").trim() ?? "";
    if (back === "") {
      warnings.push({ line: draft.line, reason: "missingBack" });
    } else if (front !== "") {
      cards.push({ back, front });
    }
  }
  if (cards.length === 0) {
    warnings.push({ line: block.line, reason: "emptyActivity" });
    return null;
  }
  return { cards, line: block.line, title: block.title, type: "flashcards" };
}

function parseSequence(
  block: Block,
  warnings: ProgramWarning[]
): ParsedSequence {
  const { keys } = readKeys(block.body, (key) => is(key, "order"));
  const order = keyValue(keys, "order");
  const steps: (ParsedLink | ParsedQuiz)[] = [];
  for (const child of block.children) {
    let step: ParsedLink | ParsedQuiz | null = null;
    if (is(child.kind, "link")) {
      step = parseLink(child, warnings);
    } else if (is(child.kind, "quiz")) {
      step = parseQuiz(child, warnings);
    } else {
      // A sequence holds links and quizzes, as in the app.
      warnings.push({ line: child.line, reason: "notInSequence" });
    }
    if (step) {
      steps.push(step);
    }
  }
  return {
    line: block.line,
    order: order && is(order.value, "orderLock") ? "lock" : "suggest",
    steps,
    title: block.title,
    type: "sequence",
  };
}

const ACTIVITY_PARSERS: [
  keyof typeof KEYWORDS,
  (block: Block, warnings: ProgramWarning[]) => ParsedActivity | null,
][] = [
  ["link", parseLink],
  ["quiz", parseQuiz],
  ["flashcards", parseFlashcards],
  ["sequence", parseSequence],
];

function parseModule(block: Block, warnings: ProgramWarning[]): ParsedModule {
  const { keys } = readKeys(block.body, (key) => is(key, "rule"));
  const rule = readRule(keyValue(keys, "rule"), "module", warnings);
  const activities: ParsedActivity[] = [];
  for (const child of block.children) {
    const parser = ACTIVITY_PARSERS.find(([keyword]) =>
      is(child.kind, keyword)
    )?.[1];
    if (!parser) {
      warnings.push({ line: child.line, reason: "unknownBlock" });
      continue;
    }
    const activity = parser(child, warnings);
    if (activity) {
      activities.push(activity);
    }
  }
  return { activities, line: block.line, name: block.title, rule };
}

const EXAM_KEYS: (keyof typeof KEYWORDS)[] = [
  "modules",
  "questions",
  "time",
  "passingScore",
  "rule",
];

function wholeNumber(value: string | undefined): number | null {
  return value !== undefined && DIGITS.test(value.trim())
    ? Number(value.trim())
    : null;
}

function parseExam(block: Block, warnings: ProgramWarning[]): ParsedExam {
  const { keys, rest } = readKeys(block.body, (key) =>
    EXAM_KEYS.some((keyword) => is(key, keyword))
  );
  return {
    line: block.line,
    moduleNames: names(keyValue(keys, "modules")?.value ?? ""),
    passingScore:
      wholeNumber(keyValue(keys, "passingScore")?.value.replace("%", "")) ??
      DEFAULT_PASSING_SCORE,
    questionCount:
      wholeNumber(keyValue(keys, "questions")?.value) ?? DEFAULT_QUESTION_COUNT,
    questions: parseQuestions(rest, warnings),
    rule: readRule(keyValue(keys, "rule"), "exam", warnings),
    timeLimitMinutes: wholeNumber(keyValue(keys, "time")?.value),
    title: block.title,
  };
}

export function parseProgramMarkdown(markdown: string): ParsedProgramFile {
  const lines = unwrap(
    markdown
      .split(LINE_BREAK)
      .map((text, index) => ({ number: index + 1, text }))
  );
  const warnings: ProgramWarning[] = [];
  // Words before the program heading are the AI's chatter (§1 AC-7).
  const root = toBlocks(lines).find(
    (block) =>
      block.level === 1 && (block.kind === "" || is(block.kind, "program"))
  );
  if (!root?.title) {
    return {
      program: null,
      warnings: [{ line: lines[0]?.number ?? 1, reason: "missingProgram" }],
    };
  }

  const program: ParsedProgram = { exams: [], modules: [], name: root.title };
  for (const child of root.children) {
    if (is(child.kind, "module")) {
      program.modules.push(parseModule(child, warnings));
    } else if (is(child.kind, "exam")) {
      program.exams.push(parseExam(child, warnings));
    } else {
      warnings.push({ line: child.line, reason: "unknownBlock" });
    }
  }
  warnings.sort((a, b) => a.line - b.line);
  return { program, warnings };
}

export type ProgramPromptLanguage = "en" | "pt-BR";

interface ProgramPromptInput {
  extraInstructions?: string;
  language: ProgramPromptLanguage;
  topic: string;
}

const EXAMPLES: Record<ProgramPromptLanguage, string> = {
  en: `# Program: Algorithms

## Module: Basics

### Link: Complexity video lesson
https://www.youtube.com/watch?v=example

### Quiz: Complexity check
What is the complexity of binary search?
- [x] $O(\\log n)$
- [ ] $O(n)$
- [ ] $O(1)$

### Flashcards: Terms
Front: Big-O
Back: An upper bound on how a function grows.

## Module: Arrays and Hashing
Unlocks after: Basics

### Sequence: Hashing review
Order: lock

#### Link: Hashing handout
https://example.com/hashing

#### Quiz: Hashing in practice
What is a collision?
- [x] Two keys in the same bucket
- [ ] A key with no value

## Exam: Exam 1
Modules: Basics; Arrays and Hashing
Questions: 10
Time: 30
Passing score: 70
Unlocks after: the exam's modules

Which structure is FIFO?
- [x] Queue
- [ ] Stack
`,
  "pt-BR": `# Programa: Algoritmos

## Módulo: Fundamentos

### Link: Videoaula de complexidade
https://www.youtube.com/watch?v=exemplo

### Quiz: Fixação de complexidade
Qual a complexidade da busca binária?
- [x] $O(\\log n)$
- [ ] $O(n)$
- [ ] $O(1)$

### Flashcards: Termos
Frente: Big-O
Verso: Limite superior do crescimento de uma função.

## Módulo: Arrays e Hashing
Libera depois de: Fundamentos

### Sequência: Revisão de hashing
Ordem: bloquear

#### Link: Apostila de hashing
https://exemplo.com/hashing

#### Quiz: Hashing na prática
O que é uma colisão?
- [x] Duas chaves no mesmo bucket
- [ ] Uma chave sem valor

## Prova: Prova 1
Módulos: Fundamentos; Arrays e Hashing
Perguntas: 10
Tempo: 30
Nota: 70
Libera depois de: módulos da prova

Qual estrutura segue FIFO?
- [x] Fila
- [ ] Pilha
`,
};

const PROMPTS: Record<
  ProgramPromptLanguage,
  (topic: string, example: string) => string
> = {
  en: (topic, example) => `Create a complete study program about: "${topic}".

Reply ONLY with a Markdown (.md) file, with no text before or after it, in exactly this format (an example with one of each block):

\`\`\`markdown
${example}\`\`\`

Rules:
- One "# Program:" line at the top. Then "## Module:" blocks and, at the end, "## Exam:" blocks.
- Inside a module, the activities are "### Quiz:", "### Flashcards:", "### Link:" and "### Sequence:". No PDFs or images.
- A link has its address (http or https) on the line below its title. Only use addresses you are sure exist.
- A quiz is a list of questions: the statement, then its answers as "- [ ]" items, with exactly ONE right answer marked "- [x]" and at least two answers in all.
- Flashcards are "Front:" / "Back:" pairs.
- A sequence groups links and quizzes in "####" steps, done in order; "Order: lock" makes each step wait for the one before, "Order: suggest" only suggests the order.
- A module may have, right below its title, "Unlocks after:" followed by "previous" (every module before it), module names separated by ";" (all of them), "any of: A; B" (any one) or "passing the exam: <exam title>".
- An exam has "Modules:" (names separated by ";"; they must have a quiz), "Questions:" (how many to draw), "Time:" (minutes, optional), "Passing score:" (percent) and, optionally, "Unlocks after:" with "the exam's modules", module names, "any of: …" or "passing the exam: …". Questions below it are its own, in the quiz format.
- Use the exact names of modules and exams wherever a rule or an exam refers to them.
- Use LaTeX only for actual math, always between $...$ or $$...$$ — never \\(...\\) or \\[...\\].
- Provide the result as a downloadable file named program.md. If you cannot create files, put the whole program in a single markdown code block.`,
  "pt-BR": (
    topic,
    example
  ) => `Crie um programa de estudos completo sobre: "${topic}".

Responda SOMENTE com um arquivo Markdown (.md), sem nenhum texto antes ou depois, exatamente neste formato (um exemplo com um bloco de cada tipo):

\`\`\`markdown
${example}\`\`\`

Regras:
- Uma linha "# Programa:" no topo. Depois, blocos "## Módulo:" e, no fim, blocos "## Prova:".
- Dentro de um módulo, as atividades são "### Quiz:", "### Flashcards:", "### Link:" e "### Sequência:". Sem PDFs nem imagens.
- Um link tem o endereço (http ou https) na linha abaixo do título. Use só endereços que você tem certeza de que existem.
- Um quiz é uma lista de perguntas: o enunciado e, abaixo, as alternativas como itens "- [ ]", com exatamente UMA correta marcada "- [x]" e ao menos duas no total.
- Flashcards são pares "Frente:" / "Verso:".
- Uma sequência agrupa links e quizzes em etapas "####", feitas em ordem; "Ordem: bloquear" faz cada etapa esperar a anterior, "Ordem: sugerir" só sugere a ordem.
- Um módulo pode ter, logo abaixo do título, "Libera depois de:" seguido de "anteriores" (todos os módulos antes dele), nomes de módulos separados por ";" (todos eles), "qualquer um de: A; B" (qualquer um) ou "passar na prova: <título da prova>".
- Uma prova tem "Módulos:" (nomes separados por ";"; eles precisam ter quiz), "Perguntas:" (quantas sortear), "Tempo:" (minutos, opcional), "Nota:" (porcentagem para passar) e, opcional, "Libera depois de:" com "módulos da prova", nomes de módulos, "qualquer um de: …" ou "passar na prova: …". As perguntas abaixo dela são só dela, no formato do quiz.
- Use os nomes exatos dos módulos e das provas sempre que uma regra ou uma prova se referir a eles.
- Use LaTeX só para fórmulas matemáticas, sempre entre $...$ ou $$...$$ — nunca \\(...\\) ou \\[...\\].
- Entregue o resultado como um arquivo para download chamado programa.md. Se não puder gerar arquivos, coloque o programa inteiro em um único bloco de código markdown.`,
};

const EXTRA_LABEL: Record<ProgramPromptLanguage, string> = {
  en: "Also:",
  "pt-BR": "Além disso:",
};

export function buildProgramPrompt({
  extraInstructions,
  language,
  topic,
}: ProgramPromptInput): string {
  const prompt = PROMPTS[language](topic.trim(), EXAMPLES[language]);
  const extra = extraInstructions?.trim();
  return extra ? `${prompt}\n\n${EXTRA_LABEL[language]} ${extra}` : prompt;
}
