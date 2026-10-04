import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import {
  activities as activitiesTable,
  modules as modulesTable,
  unlockRequirements as unlockRequirementsTable,
} from "@/database/schema";
import { backfillSequenceData } from "@/database/sequence-backfill";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { flashcards as flashcardsNamespace } from "@/ipc/flashcards";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";
import { review as reviewNamespace } from "@/ipc/review";
import { countDueReviews } from "@/main/due-reviews";
import { collectBackupData, restoreBackupData } from "@/utils/backup-data";

/**
 * RED phase (docs/specs/sequences-and-locks.md, "1. Dados"): order, groups
 * of sub-activities, unlock rules and completion, at the data layer.
 */

/** In-process clients, called the way the renderer calls them. */
function createClients() {
  return {
    activities: createRouterClient(activitiesNamespace),
    flashcards: createRouterClient(flashcardsNamespace),
    modules: createRouterClient(modulesNamespace),
    programs: createRouterClient(programsNamespace),
    quiz: createRouterClient(quizNamespace),
    review: createRouterClient(reviewNamespace),
  };
}

describe("sequences and locks: data (sequences-and-locks.md §1)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let clients: ReturnType<typeof createClients>;
  let programId: string;
  let moduleId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-sequences-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    clients = createClients();
    programId = (await clients.programs.create({ name: "Anatomia" })).id;
    moduleId = (await clients.modules.create({ name: "Esqueleto", programId }))
      .id;
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

  describe("order (AC-1, AC-2, AC-3)", () => {
    it("adds new modules at the end and lists them in that order", async () => {
      const zeta = await clients.modules.create({ name: "Zeta", programId });
      const alpha = await clients.modules.create({ name: "Alpha", programId });

      expect(ids(await clients.modules.list({ programId }))).toEqual([
        moduleId,
        zeta.id,
        alpha.id,
      ]);
    });

    it("reorders modules", async () => {
      const second = await clients.modules.create({
        name: "Músculos",
        programId,
      });

      await clients.modules.reorder({ ids: [second.id, moduleId], programId });

      expect(ids(await clients.modules.list({ programId }))).toEqual([
        second.id,
        moduleId,
      ]);
    });

    it("reorders activities", async () => {
      const pdf = await clients.activities.create({
        moduleId,
        title: "Capítulo",
        type: "pdf",
      });
      const link = await clients.activities.create({
        moduleId,
        title: "Aula",
        type: "link",
      });

      await clients.activities.reorder({ ids: [link.id, pdf.id], moduleId });

      expect(ids(await clients.activities.list({ moduleId }))).toEqual([
        link.id,
        pdf.id,
      ]);
    });
  });

  describe("groups (AC-4)", () => {
    it("keeps sub-activities inside their group, in their own order", async () => {
      const group = await clients.activities.create({
        moduleId,
        title: "Atividade Revisória",
        type: "group",
      });
      const pdf = await clients.activities.create({
        moduleId,
        parentActivityId: group.id,
        title: "PDF",
        type: "pdf",
      });
      const video = await clients.activities.create({
        moduleId,
        parentActivityId: group.id,
        title: "Vídeo",
        type: "link",
      });

      expect(ids(await clients.activities.list({ moduleId }))).toEqual([
        group.id,
      ]);
      expect(
        ids(
          await clients.activities.list({
            moduleId,
            parentActivityId: group.id,
          })
        )
      ).toEqual([pdf.id, video.id]);

      await clients.activities.reorder({
        ids: [video.id, pdf.id],
        moduleId,
        parentActivityId: group.id,
      });
      expect(
        ids(
          await clients.activities.list({
            moduleId,
            parentActivityId: group.id,
          })
        )
      ).toEqual([video.id, pdf.id]);
    });

    it("refuses a group or a deck inside a group", async () => {
      const group = await clients.activities.create({
        moduleId,
        title: "Grupo",
        type: "group",
      });

      await expect(
        clients.activities.create({
          moduleId,
          parentActivityId: group.id,
          title: "Outro grupo",
          type: "group",
        })
      ).rejects.toThrow();
      await expect(
        clients.activities.create({
          moduleId,
          parentActivityId: group.id,
          title: "Baralho",
          type: "flashcard_deck",
        })
      ).rejects.toThrow();
    });
  });

  describe("unlock rules (AC-5)", () => {
    it("stores a rule and replaces the previous one", async () => {
      const first = await clients.activities.create({
        moduleId,
        title: "A",
        type: "pdf",
      });
      const second = await clients.activities.create({
        moduleId,
        title: "B",
        type: "link",
      });
      const locked = await clients.activities.create({
        moduleId,
        title: "C",
        type: "quiz",
      });

      await clients.activities.setUnlockRule({
        id: locked.id,
        mode: "any",
        requiredIds: [first.id, second.id],
      });
      await clients.activities.setUnlockRule({
        id: locked.id,
        mode: "all",
        requiredIds: [first.id],
      });

      const row = db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, locked.id))
        .get();
      expect(row?.unlockMode).toBe("all");
      const required = db
        .select()
        .from(unlockRequirementsTable)
        .where(eq(unlockRequirementsTable.subjectId, locked.id))
        .all();
      expect(required.map((requirement) => requirement.requiredId)).toEqual([
        first.id,
      ]);
    });

    it("refuses itself or an item from another program", async () => {
      const activity = await clients.activities.create({
        moduleId,
        title: "A",
        type: "pdf",
      });
      const otherProgram = await clients.programs.create({ name: "Cálculo" });
      const otherModule = await clients.modules.create({
        name: "Derivadas",
        programId: otherProgram.id,
      });

      await expect(
        clients.activities.setUnlockRule({
          id: activity.id,
          mode: "any",
          requiredIds: [activity.id],
        })
      ).rejects.toThrow();
      await expect(
        clients.modules.setUnlockRule({
          id: moduleId,
          mode: "all",
          requiredIds: [otherModule.id],
        })
      ).rejects.toThrow();
    });

    it("stores a module's rule", async () => {
      const second = await clients.modules.create({
        name: "Músculos",
        programId,
      });

      await clients.modules.setUnlockRule({
        id: second.id,
        mode: "previous",
        requiredIds: [],
      });

      expect(
        (await clients.modules.list({ programId })).find(
          (row) => row.id === second.id
        )?.unlockMode
      ).toBe("previous");
    });
  });

  describe("completion (AC-6)", () => {
    it("marks an activity done on its first rating, and keeps that date", async () => {
      const pdf = await clients.activities.create({
        moduleId,
        title: "Capítulo",
        type: "pdf",
      });

      await clients.review.markActivityDifficulty({
        activityId: pdf.id,
        rating: "good",
      });
      const firstDone = (await clients.activities.list({ moduleId }))[0]
        .completedAt;
      await clients.review.markActivityDifficulty({
        activityId: pdf.id,
        rating: "easy",
      });

      expect(firstDone).toBeInstanceOf(Date);
      expect(
        (await clients.activities.list({ moduleId }))[0].completedAt
      ).toEqual(firstDone);
    });

    it("marks a deck done when its first card is rated", async () => {
      const deck = await clients.activities.create({
        moduleId,
        title: "Ossos",
        type: "flashcard_deck",
      });
      await clients.flashcards.create({
        activityId: deck.id,
        back: "22",
        front: "?",
      });
      await clients.review.ensureReviewItems({ activityId: deck.id });
      const [item] = await clients.review.listDue({ activityId: deck.id });

      await clients.review.submitRating({
        rating: "good",
        reviewItemId: item.id,
      });

      expect(
        (await clients.activities.list({ moduleId }))[0].completedAt
      ).toBeInstanceOf(Date);
    });

    it("marks a sub-activity done when it is completed in its group", async () => {
      const group = await clients.activities.create({
        moduleId,
        title: "Grupo",
        type: "group",
      });
      const pdf = await clients.activities.create({
        moduleId,
        parentActivityId: group.id,
        title: "PDF",
        type: "pdf",
      });

      await clients.activities.complete({ id: pdf.id });

      expect(
        (
          await clients.activities.list({
            moduleId,
            parentActivityId: group.id,
          })
        )[0].completedAt
      ).toBeInstanceOf(Date);
    });
  });

  describe("deleting a group (AC-7)", () => {
    it("hides its sub-activities with it, and brings them back on undo", async () => {
      const group = await clients.activities.create({
        moduleId,
        title: "Grupo",
        type: "group",
      });
      const pdf = await clients.activities.create({
        moduleId,
        parentActivityId: group.id,
        title: "PDF",
        type: "pdf",
      });

      await clients.activities.softDelete({ id: group.id });
      expect(
        db
          .select()
          .from(activitiesTable)
          .where(eq(activitiesTable.id, pdf.id))
          .get()?.deletedAt
      ).toBeInstanceOf(Date);

      await clients.activities.restore({ id: group.id });
      expect(
        ids(
          await clients.activities.list({
            moduleId,
            parentActivityId: group.id,
          })
        )
      ).toEqual([pdf.id]);
    });
  });

  describe("backup (AC-8)", () => {
    it("carries the unlock rules, and restores a backup without them", async () => {
      const first = await clients.activities.create({
        moduleId,
        title: "A",
        type: "pdf",
      });
      const locked = await clients.activities.create({
        moduleId,
        title: "B",
        type: "link",
      });
      await clients.activities.setUnlockRule({
        id: locked.id,
        mode: "all",
        requiredIds: [first.id],
      });

      const data = collectBackupData(db);
      expect(data.unlockRequirements).toHaveLength(1);

      restoreBackupData(db, data);
      expect(db.select().from(unlockRequirementsTable).all()).toHaveLength(1);

      const { unlockRequirements: _ignored, ...older } = data;
      restoreBackupData(db, older);
      expect(db.select().from(unlockRequirementsTable).all()).toHaveLength(0);
      expect(ids(await clients.activities.list({ moduleId }))).toEqual([
        first.id,
        locked.id,
      ]);
    });
  });

  describe("data from before sequences (AC-1, AC-6)", () => {
    it("keeps the order lists showed, and dates each first rating", async () => {
      const zeta = await clients.modules.create({ name: "Zeta", programId });
      const alpha = await clients.modules.create({ name: "Alpha", programId });
      const first = await clients.activities.create({
        moduleId,
        title: "Primeira",
        type: "pdf",
      });
      const second = await clients.activities.create({
        moduleId,
        title: "Segunda",
        type: "link",
      });
      await clients.review.markActivityDifficulty({
        activityId: second.id,
        rating: "hard",
      });
      // As it was before migration 0011: no positions, no completion.
      db.update(modulesTable).set({ position: 0 }).run();
      db.update(activitiesTable).set({ completedAt: null, position: 0 }).run();

      backfillSequenceData(db);

      expect(ids(await clients.modules.list({ programId }))).toEqual([
        alpha.id,
        moduleId,
        zeta.id,
      ]);
      const list = await clients.activities.list({ moduleId });
      expect(ids(list)).toEqual([first.id, second.id]);
      expect(list[0].completedAt).toBeNull();
      expect(list[1].completedAt).toBeInstanceOf(Date);
    });
  });

  describe("locks in the schedule (§2 AC-5, AC-6)", () => {
    it("says what is locked and leaves it out of the schedule and the tray count", async () => {
      const first = await clients.activities.create({
        moduleId,
        title: "Capítulo",
        type: "pdf",
      });
      const second = await clients.activities.create({
        moduleId,
        title: "Quiz",
        type: "quiz",
      });
      await clients.review.markActivityDifficulty({
        activityId: second.id,
        rating: "again",
      });
      const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      expect(countDueReviews(db, inTwoDays)).toBe(1);

      await clients.activities.setUnlockRule({
        id: second.id,
        mode: "all",
        requiredIds: [first.id],
      });

      const locks = await clients.review.listLocks();
      expect(locks.activities[second.id]).toEqual({
        locked: true,
        missing: [{ id: first.id, kind: "activity" }],
      });
      expect(
        (await clients.review.listSchedule()).map((row) => row.activityId)
      ).not.toContain(second.id);
      expect(countDueReviews(db, inTwoDays)).toBe(0);

      await clients.review.markActivityDifficulty({
        activityId: first.id,
        rating: "good",
      });
      expect((await clients.review.listLocks()).activities[second.id]).toBe(
        undefined
      );
      expect(
        (await clients.review.listSchedule()).map((row) => row.activityId)
      ).toContain(second.id);
    });
  });

  describe("imported quizzes (§3 AC-5)", () => {
    const QUESTIONS = [
      {
        options: [
          { isCorrect: true, text: "Fêmur" },
          { isCorrect: false, text: "Tíbia" },
        ],
        text: "Maior osso?",
      },
    ];

    it("puts an imported quiz at the end, or inside a sequence", async () => {
      const pdf = await clients.activities.create({
        moduleId,
        title: "Capítulo",
        type: "pdf",
      });
      const group = await clients.activities.create({
        moduleId,
        title: "Sequência",
        type: "group",
      });

      const loose = await clients.quiz.createWithQuestions({
        moduleId,
        questions: QUESTIONS,
        title: "Quiz solto",
      });
      const inside = await clients.quiz.createWithQuestions({
        moduleId,
        parentActivityId: group.id,
        questions: QUESTIONS,
        title: "Quiz da sequência",
      });

      expect(ids(await clients.activities.list({ moduleId }))).toEqual([
        pdf.id,
        group.id,
        loose.id,
      ]);
      expect(
        ids(
          await clients.activities.list({
            moduleId,
            parentActivityId: group.id,
          })
        )
      ).toEqual([inside.id]);
    });
  });

  describe("rules for the screens (§4 AC-1)", () => {
    it("lists a program's activities by module, and reads back a rule", async () => {
      const second = await clients.modules.create({
        name: "Músculos",
        programId,
      });
      const pdf = await clients.activities.create({
        moduleId,
        title: "Capítulo",
        type: "pdf",
      });
      const quiz = await clients.activities.create({
        moduleId: second.id,
        title: "Quiz",
        type: "quiz",
      });

      const all = await clients.activities.listByProgram({ programId });
      expect(all.map((row) => [row.id, row.moduleName])).toEqual([
        [pdf.id, "Esqueleto"],
        [quiz.id, "Músculos"],
      ]);

      await clients.activities.setUnlockRule({
        id: quiz.id,
        mode: "any",
        requiredIds: [pdf.id],
      });
      await expect(
        clients.activities.getUnlockRule({ id: quiz.id })
      ).resolves.toEqual({ mode: "any", requiredIds: [pdf.id] });
      await clients.modules.setUnlockRule({
        id: second.id,
        mode: "all",
        requiredIds: [moduleId],
      });
      await expect(
        clients.modules.getUnlockRule({ id: second.id })
      ).resolves.toEqual({ mode: "all", requiredIds: [moduleId] });
    });
  });
});
