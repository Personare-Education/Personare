import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { and, asc, eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import {
  activities as activitiesTable,
  examModules as examModulesTable,
  exams as examsTable,
  flashcards as flashcardsTable,
  modules as modulesTable,
  quizOptions as quizOptionsTable,
  quizQuestions as quizQuestionsTable,
  unlockRequirements as unlockTable,
} from "@/database/schema";
import { setDatabaseClient } from "@/ipc/database/state";
import { type McpBridge, startMcpBridge } from "@/main/mcp-bridge";
import { createPersonareMcpServer } from "@/mcp/server";

/**
 * RED phase (docs/specs/mcp-content-tools.md): modules, activities and
 * exams, each with or without an unlock rule, as Claude calls them.
 */

let tmpDir: string;
let dataDir: string;
let db: DatabaseClient;
let bridge: McpBridge | undefined;
let client: Client;
const onDataChanged = vi.fn();

type ToolResult = Awaited<ReturnType<Client["callTool"]>>;

function text(result: ToolResult): string {
  return (result.content as { text?: string }[])
    .map((part) => part.text ?? "")
    .join("\n");
}

/** Calls a tool and returns its structured result, failing on a tool error. */
async function ok<T = Record<string, unknown>>(
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const result = await client.callTool({ arguments: args, name });
  if (result.isError) {
    throw new Error(`${name} failed: ${text(result)}`);
  }
  return result.structuredContent as T;
}

function quizQuestion(statement: string) {
  return {
    options: [
      { is_correct: true, text: "Certa" },
      { is_correct: false, text: "Errada" },
    ],
    text: statement,
  };
}

/** A program with one module holding a quiz, so exams can draw from it. */
async function programWithQuizModule() {
  const program = await ok<{ id: string }>("create_program", {
    name: "Cálculo I",
  });
  const module = await ok<{ id: string }>("create_module", {
    name: "Limites",
    program_id: program.id,
  });
  await ok("create_activity", {
    module_id: module.id,
    questions: [quizQuestion("Quanto é 1 + 1?")],
    title: "Quiz de limites",
    type: "quiz",
  });
  return { moduleId: module.id, programId: program.id };
}

function ruleOf(subjectId: string) {
  return db
    .select({ requiredId: unlockTable.requiredId })
    .from(unlockTable)
    .where(eq(unlockTable.subjectId, subjectId))
    .all()
    .map((row) => row.requiredId)
    .sort();
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-mcp-content-"));
  dataDir = path.join(tmpDir, "data");
  fs.mkdirSync(dataDir);
  db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
  runMigrations(db);
  setDatabaseClient(db);
  onDataChanged.mockClear();
  bridge = await startMcpBridge({ dataDir, onDataChanged });
  const server = createPersonareMcpServer({ dataDir });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
});

afterEach(async () => {
  await client.close();
  await bridge?.close();
  bridge = undefined;
  // Windows won't delete an open sqlite file (EPERM): close it first.
  db.$client.close();
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

describe("create_module (AC-1)", () => {
  it("creates modules at the end of the program, with or without a rule", async () => {
    const program = await ok<{ id: string }>("create_program", {
      name: "Anatomia",
    });
    const first = await ok<{ id: string }>("create_module", {
      name: "Tórax",
      program_id: program.id,
    });
    const second = await ok<{ id: string }>("create_module", {
      name: "Abdome",
      program_id: program.id,
      unlock: { mode: "all", required_ids: [first.id] },
    });
    const third = await ok<{ id: string }>("create_module", {
      name: "Pelve",
      program_id: program.id,
      unlock: { mode: "previous" },
    });

    const rows = db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.programId, program.id))
      .orderBy(asc(modulesTable.position))
      .all();
    expect(rows.map((row) => [row.name, row.unlockMode])).toEqual([
      ["Tórax", "none"],
      ["Abdome", "all"],
      ["Pelve", "previous"],
    ]);
    expect(ruleOf(second.id)).toEqual([first.id]);
    expect(ruleOf(third.id)).toEqual([]);
    expect(onDataChanged).toHaveBeenCalledWith("modules");
  });

  it("waits for an exam", async () => {
    const { moduleId, programId } = await programWithQuizModule();
    const exam = await ok<{ id: string }>("create_exam", {
      module_ids: [moduleId],
      program_id: programId,
      question_count: 1,
      title: "P1",
    });

    const next = await ok<{ id: string }>("create_module", {
      name: "Derivadas",
      program_id: programId,
      unlock: { mode: "exam", required_ids: [exam.id] },
    });

    expect(ruleOf(next.id)).toEqual([exam.id]);
  });
});

describe("create_activity (AC-2)", () => {
  let moduleId: string;
  let programId: string;

  beforeEach(async () => {
    const program = await ok<{ id: string }>("create_program", {
      name: "Direito",
    });
    programId = program.id;
    const module = await ok<{ id: string }>("create_module", {
      name: "Constitucional",
      program_id: programId,
    });
    moduleId = module.id;
  });

  it("creates a link and a PDF", async () => {
    const link = await ok<{ id: string }>("create_activity", {
      module_id: moduleId,
      title: "Art. 5º",
      type: "link",
      url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    });
    const pdf = await ok<{ id: string }>("create_activity", {
      file_path: "C:\\Estudos\\resumo.pdf",
      module_id: moduleId,
      title: "Resumo",
      type: "pdf",
    });

    const rows = db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.moduleId, moduleId))
      .all();
    expect(rows.find((row) => row.id === link.id)).toMatchObject({
      type: "link",
      url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    });
    expect(rows.find((row) => row.id === pdf.id)).toMatchObject({
      filePath: "C:\\Estudos\\resumo.pdf",
      type: "pdf",
    });
    expect(onDataChanged).toHaveBeenCalledWith("activities");
  });

  it("creates a quiz with its questions and options", async () => {
    const quiz = await ok<{ id: string }>("create_activity", {
      module_id: moduleId,
      questions: [
        quizQuestion("Qual artigo trata dos direitos fundamentais?"),
        quizQuestion("Quantos incisos?"),
      ],
      title: "Quiz do art. 5º",
      type: "quiz",
    });

    const questions = db
      .select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.activityId, quiz.id))
      .all();
    expect(questions).toHaveLength(2);
    const options = db
      .select()
      .from(quizOptionsTable)
      .where(eq(quizOptionsTable.questionId, questions[0].id))
      .all();
    expect(options.map((o) => [o.text, o.isCorrect]).sort()).toEqual([
      ["Certa", true],
      ["Errada", false],
    ]);
  });

  it("creates a flashcard deck with its cards", async () => {
    const deck = await ok<{ id: string }>("create_activity", {
      flashcards: [
        { back: "Remédio contra prisão ilegal", front: "Habeas corpus" },
        { back: "Remédio para informações pessoais", front: "Habeas data" },
      ],
      module_id: moduleId,
      title: "Remédios constitucionais",
      type: "flashcard_deck",
    });

    const cards = db
      .select()
      .from(flashcardsTable)
      .where(eq(flashcardsTable.activityId, deck.id))
      .all();
    expect(cards.map((card) => card.front).sort()).toEqual([
      "Habeas corpus",
      "Habeas data",
    ]);
  });

  it("creates a sequence locked in order", async () => {
    const sequence = await ok<{ id: string; steps: { id: string }[] }>(
      "create_activity",
      {
        module_id: moduleId,
        order: "lock",
        steps: [
          {
            title: "Leia o art. 5º",
            type: "link",
            url: "https://example.com/art5",
          },
          {
            questions: [quizQuestion("Pergunta")],
            title: "Quiz do art. 5º",
            type: "quiz",
          },
        ],
        title: "Direitos fundamentais",
        type: "sequence",
      }
    );

    const group = db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.id, sequence.id))
      .get();
    expect(group?.type).toBe("group");
    const steps = db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.parentActivityId, sequence.id))
      .orderBy(asc(activitiesTable.position))
      .all();
    expect(steps.map((s) => [s.type, s.unlockMode])).toEqual([
      ["link", "none"],
      ["quiz", "previous"],
    ]);
  });

  it("saves the activity's rule", async () => {
    const first = await ok<{ id: string }>("create_activity", {
      module_id: moduleId,
      title: "A",
      type: "link",
      url: "https://example.com/a",
    });
    const second = await ok<{ id: string }>("create_activity", {
      module_id: moduleId,
      title: "B",
      type: "link",
      unlock: { mode: "any", required_ids: [first.id] },
      url: "https://example.com/b",
    });

    expect(
      db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, second.id))
        .get()?.unlockMode
    ).toBe("any");
    expect(ruleOf(second.id)).toEqual([first.id]);
  });
});

describe("create_exam (AC-3)", () => {
  it("creates an exam with its modules, its own questions and a rule", async () => {
    const { moduleId, programId } = await programWithQuizModule();
    const exam = await ok<{ id: string }>("create_exam", {
      module_ids: [moduleId],
      program_id: programId,
      question_count: 5,
      questions: [quizQuestion("Pergunta só da prova")],
      time_limit_minutes: 30,
      title: "Prova final",
      unlock: { mode: "sources" },
    });

    const row = db
      .select()
      .from(examsTable)
      .where(eq(examsTable.id, exam.id))
      .get();
    expect(row).toMatchObject({
      passingScore: 70,
      questionCount: 5,
      timeLimitMinutes: 30,
      title: "Prova final",
      unlockMode: "sources",
    });
    expect(
      db
        .select()
        .from(examModulesTable)
        .where(eq(examModulesTable.examId, exam.id))
        .all()
        .map((m) => m.moduleId)
    ).toEqual([moduleId]);
    expect(
      db
        .select()
        .from(quizQuestionsTable)
        .where(eq(quizQuestionsTable.examId, exam.id))
        .all()
    ).toHaveLength(1);
    expect(onDataChanged).toHaveBeenCalledWith("exams");
  });
});

describe("all or nothing (AC-4)", () => {
  it("leaves no module behind when its rule would lock it for good", async () => {
    const program = await ok<{ id: string }>("create_program", {
      name: "Física",
    });
    const other = await ok<{ id: string }>("create_program", {
      name: "Química",
    });
    const foreign = await ok<{ id: string }>("create_module", {
      name: "Átomos",
      program_id: other.id,
    });

    const result = await client.callTool({
      arguments: {
        name: "Cinemática",
        program_id: program.id,
        unlock: { mode: "all", required_ids: [foreign.id] },
      },
      name: "create_module",
    });

    expect(result.isError).toBe(true);
    // The handler's own reason, not a generic server error.
    expect(text(result)).toContain("same program");
    const live = db
      .select()
      .from(modulesTable)
      .where(
        and(
          eq(modulesTable.programId, program.id),
          isNull(modulesTable.deletedAt)
        )
      )
      .all();
    expect(live).toEqual([]);
  });

  it("leaves no exam behind when its modules have no quiz", async () => {
    const program = await ok<{ id: string }>("create_program", {
      name: "Física",
    });
    const module = await ok<{ id: string }>("create_module", {
      name: "Sem quiz",
      program_id: program.id,
    });

    const result = await client.callTool({
      arguments: {
        module_ids: [module.id],
        program_id: program.id,
        question_count: 3,
        title: "P1",
      },
      name: "create_exam",
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("quiz");
    expect(
      db.select().from(examsTable).where(isNull(examsTable.deletedAt)).all()
    ).toEqual([]);
  });
});

describe("finding what exists (AC-5)", () => {
  it("lists the programs and outlines one, with the ids the tools ask for", async () => {
    const { moduleId, programId } = await programWithQuizModule();
    const exam = await ok<{ id: string }>("create_exam", {
      module_ids: [moduleId],
      program_id: programId,
      question_count: 1,
      title: "P1",
    });

    const { programs } = await ok<{ programs: { id: string; name: string }[] }>(
      "list_programs",
      {}
    );
    expect(programs).toEqual([{ id: programId, name: "Cálculo I" }]);

    const outline = await ok<{
      exams: { id: string; title: string }[];
      modules: {
        activities: { title: string; type: string }[];
        id: string;
        name: string;
      }[];
    }>("get_program", { program_id: programId });
    expect(outline.modules).toMatchObject([
      {
        activities: [{ title: "Quiz de limites", type: "quiz" }],
        id: moduleId,
        name: "Limites",
      },
    ]);
    expect(outline.exams).toMatchObject([{ id: exam.id, title: "P1" }]);
  });
});

describe("app closed (AC-7)", () => {
  it("asks to open Personare, for every tool", async () => {
    await bridge?.close();
    bridge = undefined;

    const calls = [
      ["list_programs", {}],
      ["get_program", { program_id: "x" }],
      ["create_module", { name: "M", program_id: "x" }],
      [
        "create_activity",
        {
          module_id: "x",
          title: "A",
          type: "link",
          url: "https://example.com",
        },
      ],
      [
        "create_exam",
        { module_ids: ["x"], program_id: "x", question_count: 1, title: "P" },
      ],
    ] as const;
    const results = await Promise.all(
      calls.map(([name, args]) => client.callTool({ arguments: args, name }))
    );
    for (const [index, result] of results.entries()) {
      const [name] = calls[index];
      expect(result.isError, name).toBe(true);
      expect(text(result), name).toContain("Abra o Personare e tente de novo.");
    }
  });
});
