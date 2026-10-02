import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { flashcards as flashcardsNamespace } from "@/ipc/flashcards";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";

/**
 * RED phase (docs/specs/safety-net.md AC-2, AC-3): undoing a deletion brings
 * the item back with everything that same deletion hid -- and nothing that
 * had been deleted on its own before.
 */

/** Soft-delete timestamps are whole seconds: keep two deletions apart. */
function nextSecond() {
  const start = Math.floor(Date.now() / 1000);
  while (Math.floor(Date.now() / 1000) === start) {
    // busy-wait into the next second
  }
}

describe("restoring a deletion", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let programs: ReturnType<typeof createRouterClient<typeof programsNamespace>>;
  let modules: ReturnType<typeof createRouterClient<typeof modulesNamespace>>;
  let activities: ReturnType<
    typeof createRouterClient<typeof activitiesNamespace>
  >;
  let flashcards: ReturnType<
    typeof createRouterClient<typeof flashcardsNamespace>
  >;
  let quiz: ReturnType<typeof createRouterClient<typeof quizNamespace>>;
  let programId: string;
  let moduleId: string;
  let deckId: string;
  let quizId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-restore-ipc-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    programs = createRouterClient(programsNamespace);
    modules = createRouterClient(modulesNamespace);
    activities = createRouterClient(activitiesNamespace);
    flashcards = createRouterClient(flashcardsNamespace);
    quiz = createRouterClient(quizNamespace);

    programId = (await programs.create({ name: "Cálculo I" })).id;
    moduleId = (await modules.create({ name: "Derivadas", programId })).id;
    deckId = (
      await activities.create({
        moduleId,
        title: "Baralho",
        type: "flashcard_deck",
      })
    ).id;
    quizId = (
      await activities.create({ moduleId, title: "Quiz", type: "quiz" })
    ).id;
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("brings back a flashcard", async () => {
    const card = await flashcards.create({
      activityId: deckId,
      back: "cos x",
      front: "sin x?",
    });
    await flashcards.softDelete({ id: card.id });

    await flashcards.restore({ id: card.id });

    expect(
      (await flashcards.list({ activityId: deckId })).map((c) => c.id)
    ).toEqual([card.id]);
  });

  it("brings back a question with its alternatives", async () => {
    const question = await quiz.createQuestion({
      activityId: quizId,
      text: "2 + 2?",
    });
    await quiz.createOption({
      isCorrect: true,
      questionId: question.id,
      text: "4",
    });
    await quiz.createOption({ questionId: question.id, text: "5" });
    await quiz.softDeleteQuestion({ id: question.id });

    await quiz.restoreQuestion({ id: question.id });

    expect(
      (await quiz.listQuestions({ activityId: quizId })).map((q) => q.id)
    ).toEqual([question.id]);
    expect(await quiz.listOptions({ questionId: question.id })).toHaveLength(2);
  });

  it("brings back an activity with the cards its deletion hid, not one deleted before", async () => {
    const kept = await flashcards.create({
      activityId: deckId,
      back: "a",
      front: "kept",
    });
    const deletedBefore = await flashcards.create({
      activityId: deckId,
      back: "b",
      front: "deleted before",
    });
    await flashcards.softDelete({ id: deletedBefore.id });
    nextSecond();
    await activities.softDelete({ id: deckId });

    await activities.restore({ id: deckId });

    expect(
      (await activities.list({ moduleId })).map((a) => a.id).sort()
    ).toEqual([deckId, quizId].sort());
    expect(
      (await flashcards.list({ activityId: deckId })).map((c) => c.id)
    ).toEqual([kept.id]);
  });

  it("brings back a module with its activities", async () => {
    await modules.softDelete({ id: moduleId });

    await modules.restore({ id: moduleId });

    expect((await modules.list({ programId })).map((m) => m.id)).toEqual([
      moduleId,
    ]);
    expect(await activities.list({ moduleId })).toHaveLength(2);
  });

  it("brings back a program with its modules and their activities", async () => {
    await programs.softDelete({ id: programId });

    await programs.restore({ id: programId });

    expect((await programs.list()).map((p) => p.id)).toEqual([programId]);
    expect(await modules.list({ programId })).toHaveLength(1);
    expect(await activities.list({ moduleId })).toHaveLength(2);
  });
});
