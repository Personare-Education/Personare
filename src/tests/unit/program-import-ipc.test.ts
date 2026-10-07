import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import {
  activities as activitiesTable,
  exams as examsTable,
  flashcards as flashcardsTable,
  modules as modulesTable,
  programs as programsTable,
} from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { exams as examsNamespace } from "@/ipc/exams";
import { flashcards as flashcardsNamespace } from "@/ipc/flashcards";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";
import { review as reviewNamespace } from "@/ipc/review";
import { collectBackupData, restoreBackupData } from "@/utils/backup-data";

/**
 * RED phase (docs/specs/program-import.md, "2. Gravar"): saving a program
 * read from Markdown -- new or completing one -- in one transaction.
 */

function createClients() {
  return {
    activities: createRouterClient(activitiesNamespace),
    exams: createRouterClient(examsNamespace),
    flashcards: createRouterClient(flashcardsNamespace),
    modules: createRouterClient(modulesNamespace),
    programs: createRouterClient(programsNamespace),
    quiz: createRouterClient(quizNamespace),
    review: createRouterClient(reviewNamespace),
  };
}

const FILE = `# Programa: Algoritmos

## Módulo: Fundamentos

### Link: Videoaula
https://exemplo.com/aula

### Quiz: Fixação
Busca binária?
- [x] O(log n)
- [ ] O(n)

Ordenação estável?
- [x] Mantém a ordem
- [ ] Embaralha

### Flashcards: Termos
Frente: Big-O
Verso: Limite superior

Frente: Pilha
Verso: LIFO

## Módulo: Hashing
Libera depois de: Fundamentos

### Sequência: Revisão
Ordem: bloquear

#### Link: Apostila
https://exemplo.com/apostila

#### Quiz: Colisões
O que é colisão?
- [x] Duas chaves no mesmo bucket
- [ ] Nada

## Prova: Prova 1
Módulos: Fundamentos; Hashing
Perguntas: 3
Tempo: 20
Nota: 60
Libera depois de: módulos da prova

Qual é FIFO?
- [x] Fila
- [ ] Pilha
`;

describe("importing a program (program-import.md §2)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let clients: ReturnType<typeof createClients>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-import-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    clients = createClients();
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  const liveModules = (programId: string) =>
    clients.modules.list({ programId });
  const titles = (rows: { title: string }[]) => rows.map((row) => row.title);

  it("creates a new program with everything in it, in file order (AC-1, AC-2)", async () => {
    const report = await clients.programs.import({ markdown: FILE });

    expect(report.programExisted).toBe(false);
    const { programId } = report;
    const modules = await liveModules(programId);
    expect(modules.map((row) => row.name)).toEqual(["Fundamentos", "Hashing"]);

    const [basics, hashing] = modules;
    const basicsActivities = await clients.activities.list({
      moduleId: basics.id,
    });
    expect(
      basicsActivities.map((row) => [row.type, row.title, row.url])
    ).toEqual([
      ["link", "Videoaula", "https://exemplo.com/aula"],
      ["quiz", "Fixação", null],
      ["flashcard_deck", "Termos", null],
    ]);
    const questions = await clients.quiz.listQuestions({
      activityId: basicsActivities[1].id,
    });
    expect(titles(questions.map((q) => ({ title: q.text })))).toEqual([
      "Busca binária?",
      "Ordenação estável?",
    ]);
    const options = await clients.quiz.listOptions({
      questionId: questions[0].id,
    });
    expect(options.map((o) => [o.text, o.isCorrect])).toEqual([
      ["O(log n)", true],
      ["O(n)", false],
    ]);
    const cards = await clients.flashcards.list({
      activityId: basicsActivities[2].id,
    });
    expect(cards.map((card) => [card.front, card.back])).toEqual([
      ["Big-O", "Limite superior"],
      ["Pilha", "LIFO"],
    ]);

    // The sequence, its steps in order, locked in order.
    const [sequence] = await clients.activities.list({ moduleId: hashing.id });
    expect([sequence.type, sequence.title]).toEqual(["group", "Revisão"]);
    const steps = await clients.activities.list({
      moduleId: hashing.id,
      parentActivityId: sequence.id,
    });
    expect(steps.map((row) => [row.type, row.title])).toEqual([
      ["link", "Apostila"],
      ["quiz", "Colisões"],
    ]);
    expect(
      (await clients.activities.getUnlockRule({ id: steps[0].id })).mode
    ).toBe("none");
    expect(
      (await clients.activities.getUnlockRule({ id: steps[1].id })).mode
    ).toBe("previous");

    // Hashing waits for Fundamentos.
    expect(await clients.modules.getUnlockRule({ id: hashing.id })).toEqual({
      mode: "all",
      requiredIds: [basics.id],
    });

    const [exam] = await clients.exams.list({ programId });
    expect(exam).toMatchObject({
      moduleIds: [basics.id, hashing.id],
      passingScore: 60,
      questionCount: 3,
      standaloneCount: 1,
      timeLimitMinutes: 20,
      title: "Prova 1",
    });
    expect(await clients.exams.getUnlockRule({ id: exam.id })).toEqual({
      mode: "sources",
      requiredIds: [],
    });
  });

  it("previews exactly what it would do, writing nothing (AC-5)", async () => {
    const preview = await clients.programs.previewImport({ markdown: FILE });

    expect(db.select().from(programsTable).all()).toEqual([]);
    expect(db.select().from(modulesTable).all()).toEqual([]);
    expect(preview.modules.map((row) => row.name)).toEqual([
      "Fundamentos",
      "Hashing",
    ]);
    expect(preview.modules[0].activities).toEqual([
      { count: 0, skipped: false, title: "Videoaula", type: "link" },
      { count: 2, skipped: false, title: "Fixação", type: "quiz" },
      { count: 2, skipped: false, title: "Termos", type: "flashcards" },
    ]);
    expect(preview.modules[1].rule).toEqual({
      mode: "all",
      names: ["Fundamentos"],
    });

    const report = await clients.programs.import({ markdown: FILE });
    const { created: _previewCreated, ...previewRest } = preview;
    const { created: _created, ...reportRest } = report;
    expect({ ...previewRest, programId: "" }).toEqual({
      ...reportRest,
      programId: "",
    });
  });

  describe("completing a program with the same name (AC-1, AC-3)", () => {
    it("adds what is new, at the end, and keeps what was there", async () => {
      const program = await clients.programs.create({ name: " algoritmos " });
      const basics = await clients.modules.create({
        name: "Fundamentos",
        programId: program.id,
      });
      const earlier = await clients.activities.create({
        moduleId: basics.id,
        title: "Capítulo 1",
        type: "pdf",
      });
      await clients.activities.create({
        moduleId: basics.id,
        title: "Videoaula",
        type: "link",
        url: "https://antigo.com",
      });

      const report = await clients.programs.import({ markdown: FILE });

      expect(report.programExisted).toBe(true);
      expect(report.programId).toBe(program.id);
      expect(db.select().from(programsTable).all()).toHaveLength(1);
      const modules = await liveModules(program.id);
      expect(modules.map((row) => [row.id === basics.id, row.name])).toEqual([
        [true, "Fundamentos"],
        [false, "Hashing"],
      ]);
      const activities = await clients.activities.list({ moduleId: basics.id });
      expect(activities.map((row) => [row.title, row.url])).toEqual([
        [earlier.title, null],
        ["Videoaula", "https://antigo.com"],
        ["Fixação", null],
        ["Termos", null],
      ]);
      expect(report.modules[0]).toMatchObject({ existed: true });
      expect(report.modules[0].activities[0]).toMatchObject({
        skipped: true,
        title: "Videoaula",
      });
    });

    it("keeps an existing module's rule, ignoring the file's (AC-4)", async () => {
      const program = await clients.programs.create({ name: "Algoritmos" });
      await clients.modules.create({
        name: "Fundamentos",
        programId: program.id,
      });
      const hashing = await clients.modules.create({
        name: "Hashing",
        programId: program.id,
      });

      const report = await clients.programs.import({ markdown: FILE });

      expect(await clients.modules.getUnlockRule({ id: hashing.id })).toEqual({
        mode: "none",
        requiredIds: [],
      });
      expect(report.modules[1]).toMatchObject({
        existed: true,
        ruleIssue: "keptExisting",
      });
    });

    it("creates nothing the second time the same file comes in", async () => {
      await clients.programs.import({ markdown: FILE });
      const counts = () => ({
        activities: db.select().from(activitiesTable).all().length,
        cards: db.select().from(flashcardsTable).all().length,
        exams: db.select().from(examsTable).all().length,
        modules: db.select().from(modulesTable).all().length,
      });
      const before = counts();

      const report = await clients.programs.import({ markdown: FILE });

      expect(counts()).toEqual(before);
      expect(report.exams[0]).toMatchObject({
        reason: "exists",
        skipped: true,
      });
      expect(
        report.modules.flatMap((row) => row.activities).every((a) => a.skipped)
      ).toBe(true);
    });
  });

  describe("rules by name (AC-4)", () => {
    it("resolves against modules that were already in the program", async () => {
      const program = await clients.programs.create({ name: "P" });
      const old = await clients.modules.create({
        name: "Antigo",
        programId: program.id,
      });

      await clients.programs.import({
        markdown:
          "# Programa: P\n## Módulo: Novo\nLibera depois de: antigo\n### Link: L\nhttps://a.com\n",
      });

      const fresh = (await liveModules(program.id)).find(
        (row) => row.name === "Novo"
      );
      expect(
        await clients.modules.getUnlockRule({ id: fresh?.id ?? "" })
      ).toEqual({ mode: "all", requiredIds: [old.id] });
    });

    it("ignores, and reports, a rule naming nothing it knows", async () => {
      const report = await clients.programs.import({
        markdown:
          "# Programa: P\n## Módulo: M\nLibera depois de: Fantasma\n### Link: L\nhttps://a.com\n",
      });

      expect(report.modules[0]).toMatchObject({ ruleIssue: "unknownName" });
      const [module] = await liveModules(report.programId);
      expect(
        (await clients.modules.getUnlockRule({ id: module.id })).mode
      ).toBe("none");
    });

    it("ignores a module waiting for an exam that draws from it", async () => {
      const report = await clients.programs.import({
        markdown: `# Programa: P
## Módulo: M
Libera depois de: passar na prova: P1
### Quiz: Q
Ok?
- [x] Sim
- [ ] Não
## Prova: P1
Módulos: M
`,
      });

      expect(report.modules[0]).toMatchObject({
        ruleIssue: "examDrawsFromModule",
      });
    });

    it("ignores a rule that would lock something for good", async () => {
      const report = await clients.programs.import({
        markdown: `# Programa: P
## Módulo: A
Libera depois de: B
### Link: L
https://a.com
## Módulo: B
Libera depois de: A
### Link: L
https://b.com
`,
      });

      expect(report.modules.map((row) => row.ruleIssue ?? null)).toEqual([
        null,
        "wouldLockForGood",
      ]);
      const [, b] = await liveModules(report.programId);
      expect((await clients.modules.getUnlockRule({ id: b.id })).mode).toBe(
        "none"
      );
    });
  });

  it("leaves out an exam's modules without a quiz, and the exam with none left", async () => {
    const report = await clients.programs.import({
      markdown: `# Programa: P
## Módulo: Com quiz
### Quiz: Q
Ok?
- [x] Sim
- [ ] Não
## Módulo: Sem quiz
### Link: L
https://a.com
## Prova: Boa
Módulos: Com quiz; Sem quiz; Fantasma
## Prova: Vazia
Módulos: Sem quiz
`,
    });

    expect(report.exams).toEqual([
      expect.objectContaining({
        droppedModules: ["Sem quiz", "Fantasma"],
        skipped: false,
        title: "Boa",
      }),
      expect.objectContaining({
        reason: "noModules",
        skipped: true,
        title: "Vazia",
      }),
    ]);
    expect(
      (await clients.exams.list({ programId: report.programId })).map(
        (exam) => exam.title
      )
    ).toEqual(["Boa"]);
  });

  it("refuses a file without a program heading", async () => {
    await expect(
      clients.programs.import({ markdown: "## Módulo: Solto\n" })
    ).rejects.toThrow();
  });

  it("undoes exactly what the import created (AC-6)", async () => {
    const program = await clients.programs.create({ name: "Algoritmos" });
    const kept = await clients.modules.create({
      name: "Fundamentos",
      programId: program.id,
    });
    const keptActivity = await clients.activities.create({
      moduleId: kept.id,
      title: "Capítulo 1",
      type: "pdf",
    });

    const report = await clients.programs.import({ markdown: FILE });
    await clients.programs.undoImport({ created: report.created });

    expect((await clients.programs.list()).map((row) => row.id)).toEqual([
      program.id,
    ]);
    expect((await liveModules(program.id)).map((row) => row.id)).toEqual([
      kept.id,
    ]);
    expect(
      (await clients.activities.list({ moduleId: kept.id })).map(
        (row) => row.id
      )
    ).toEqual([keptActivity.id]);
    expect(await clients.exams.list({ programId: program.id })).toEqual([]);
  });

  it("undoes a program the import created, whole (AC-6)", async () => {
    const report = await clients.programs.import({ markdown: FILE });

    await clients.programs.undoImport({ created: report.created });

    expect(await clients.programs.list()).toEqual([]);
  });

  it("comes back whole from a backup (AC-7)", async () => {
    const report = await clients.programs.import({ markdown: FILE });
    const data = collectBackupData(db);

    restoreBackupData(db, data);

    const modules = await liveModules(report.programId);
    expect(modules).toHaveLength(2);
    expect(
      await clients.exams.list({ programId: report.programId })
    ).toHaveLength(1);
    expect(
      (await clients.modules.getUnlockRule({ id: modules[1].id })).mode
    ).toBe("all");
  });
});
