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
  flashcards as flashcardsTable,
  modules as modulesTable,
} from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { flashcards as flashcardsNamespace } from "@/ipc/flashcards";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";

/**
 * RED phase (Issue #9, Spec Driven TDD): src/ipc/modules does not exist yet.
 * Every test below is expected to fail until Estaleiro (Developer)
 * implements the "modules" oRPC namespace (list/create/update/softDelete)
 * mirroring the pattern already used by src/ipc/programs (Issue #8).
 *
 * Unlike programs.list (no input), modules.list receives { programId } and
 * must scope its results to that Program (criterio de aceite 1).
 *
 * Procedures are exercised through `createRouterClient`, oRPC's in-process
 * server-side client -- this calls the handlers exactly the way the
 * renderer does through `ipc.client.modules.*`, without needing the
 * MessagePort/Electron transport.
 */

const MODULES_ROUTER_REGISTRATION_PATTERN = /\bmodules\b/;

describe("modules IPC namespace (Issue #9)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;
  let modulesClient: ReturnType<
    typeof createRouterClient<typeof modulesNamespace>
  >;
  let programsClient: ReturnType<
    typeof createRouterClient<typeof programsNamespace>
  >;
  let programId: string;
  let otherProgramId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-modules-ipc-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    modulesClient = createRouterClient(modulesNamespace);
    programsClient = createRouterClient(programsNamespace);

    const program = await programsClient.create({ name: "Bacharelado II" });
    programId = program.id;
    const otherProgram = await programsClient.create({ name: "Pos I" });
    otherProgramId = otherProgram.id;
  });

  afterEach(() => {
    // Windows refuses to delete a sqlite file while a connection to it is
    // still open (EPERM), unlike Linux/macOS -- close it first.
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(MODULES_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes list, create, update and softDelete procedures", () => {
    expect(modulesNamespace.list).toBeDefined();
    expect(modulesNamespace.create).toBeDefined();
    expect(modulesNamespace.update).toBeDefined();
    expect(modulesNamespace.softDelete).toBeDefined();
  });

  describe("list", () => {
    it("returns an empty array when the program has no modules", async () => {
      await expect(modulesClient.list({ programId })).resolves.toEqual([]);
    });

    it("returns modules that were created through the create procedure", async () => {
      const created = await modulesClient.create({
        name: "Modulo 1",
        programId,
      });

      const list = await modulesClient.list({ programId });

      expect(list.map((module) => module.id)).toContain(created.id);
      expect(list.map((module) => module.name)).toContain("Modulo 1");
    });

    // Modules keep their own order now, new ones at the end
    // (docs/specs/sequences-and-locks.md §1 AC-1, AC-2).
    it("orders modules as they were added", async () => {
      await modulesClient.create({ name: "Zeta", programId });
      await modulesClient.create({ name: "Alfa", programId });

      const list = await modulesClient.list({ programId });

      expect(list.map((module) => module.name)).toEqual(["Zeta", "Alfa"]);
    });

    it("only returns modules belonging to the given program", async () => {
      const inProgram = await modulesClient.create({
        name: "Deste programa",
        programId,
      });
      await modulesClient.create({
        name: "De outro programa",
        programId: otherProgramId,
      });

      const list = await modulesClient.list({ programId });

      expect(list.map((module) => module.id)).toEqual([inProgram.id]);
    });

    it("excludes soft-deleted modules", async () => {
      const active = await modulesClient.create({ name: "Ativo", programId });
      const deleted = await modulesClient.create({
        name: "Removido",
        programId,
      });
      await modulesClient.softDelete({ id: deleted.id });

      const list = await modulesClient.list({ programId });

      expect(list.map((module) => module.id)).toContain(active.id);
      expect(list.map((module) => module.id)).not.toContain(deleted.id);
    });
  });

  describe("create", () => {
    it("inserts a new module associated with the given program and returns it", async () => {
      const created = await modulesClient.create({
        name: "Modulo 1",
        programId,
      });

      expect(typeof created.id).toBe("string");
      expect(created.name).toBe("Modulo 1");
      expect(created.programId).toBe(programId);
    });

    it("rejects an empty name", async () => {
      await expect(
        modulesClient.create({ name: "", programId })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates the name of an existing module", async () => {
      const created = await modulesClient.create({
        name: "Nome Antigo",
        programId,
      });

      const updated = await modulesClient.update({
        id: created.id,
        name: "Nome Novo",
      });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Nome Novo");

      const list = await modulesClient.list({ programId });
      expect(list.find((module) => module.id === created.id)?.name).toBe(
        "Nome Novo"
      );
    });

    it("rejects an empty name", async () => {
      const created = await modulesClient.create({
        name: "Valido",
        programId,
      });

      await expect(
        modulesClient.update({ id: created.id, name: "" })
      ).rejects.toThrow();
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt on the row instead of removing it from the database", async () => {
      const created = await modulesClient.create({
        name: "Sera Removido",
        programId,
      });

      await modulesClient.softDelete({ id: created.id });

      const rawRow = db
        .select()
        .from(modulesTable)
        .where(eq(modulesTable.id, created.id))
        .get();

      expect(rawRow).toBeDefined();
      expect(rawRow?.deletedAt).not.toBeNull();
    });

    it("excludes the soft-deleted module from a subsequent list call", async () => {
      const created = await modulesClient.create({
        name: "Sera Removido",
        programId,
      });

      await modulesClient.softDelete({ id: created.id });

      const list = await modulesClient.list({ programId });

      expect(list.map((module) => module.id)).not.toContain(created.id);
    });
  });

  /**
   * RED phase (Issue #22, Spec Driven TDD): modules.softDelete does not
   * cascade to child activities/flashcards yet -- see
   * docs/specs/issue-22-cascata-soft-delete.md (AC-1). Same bug as
   * programs.softDelete, one level down the hierarchy.
   */
  describe("cascading soft-delete to activities and flashcards (Issue #22)", () => {
    let activitiesClient: ReturnType<
      typeof createRouterClient<typeof activitiesNamespace>
    >;
    let flashcardsClient: ReturnType<
      typeof createRouterClient<typeof flashcardsNamespace>
    >;

    beforeEach(() => {
      activitiesClient = createRouterClient(activitiesNamespace);
      flashcardsClient = createRouterClient(flashcardsNamespace);
    });

    it("cascades deletedAt down to every non-deleted activity and flashcard under the module", async () => {
      const module_ = await modulesClient.create({
        name: "Modulo 1",
        programId,
      });
      const activity = await activitiesClient.create({
        moduleId: module_.id,
        title: "Baralho",
        type: "flashcard_deck",
      });
      const flashcard = await flashcardsClient.create({
        activityId: activity.id,
        back: "Verso",
        front: "Frente",
      });

      await modulesClient.softDelete({ id: module_.id });

      const activityRow = db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, activity.id))
        .get();
      const flashcardRow = db
        .select()
        .from(flashcardsTable)
        .where(eq(flashcardsTable.id, flashcard.id))
        .get();

      expect(activityRow?.deletedAt).not.toBeNull();
      expect(flashcardRow?.deletedAt).not.toBeNull();
    });

    it("uses the same timestamp for the module and every cascaded child row", async () => {
      const module_ = await modulesClient.create({
        name: "Modulo 1",
        programId,
      });
      const activity = await activitiesClient.create({
        moduleId: module_.id,
        title: "Baralho",
        type: "flashcard_deck",
      });
      const flashcard = await flashcardsClient.create({
        activityId: activity.id,
        back: "Verso",
        front: "Frente",
      });

      await modulesClient.softDelete({ id: module_.id });

      const moduleRow = db
        .select()
        .from(modulesTable)
        .where(eq(modulesTable.id, module_.id))
        .get();
      const activityRow = db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, activity.id))
        .get();
      const flashcardRow = db
        .select()
        .from(flashcardsTable)
        .where(eq(flashcardsTable.id, flashcard.id))
        .get();

      expect(activityRow?.deletedAt?.getTime()).toBe(
        moduleRow?.deletedAt?.getTime()
      );
      expect(flashcardRow?.deletedAt?.getTime()).toBe(
        moduleRow?.deletedAt?.getTime()
      );
    });

    it("does not overwrite the deletedAt of an activity that was already independently soft-deleted before", async () => {
      const module_ = await modulesClient.create({
        name: "Modulo 1",
        programId,
      });
      const activity = await activitiesClient.create({
        moduleId: module_.id,
        title: "Aula",
        type: "link",
      });
      const previouslyDeletedAt = new Date("2020-01-01T00:00:00Z");
      db.update(activitiesTable)
        .set({ deletedAt: previouslyDeletedAt })
        .where(eq(activitiesTable.id, activity.id))
        .run();

      await modulesClient.softDelete({ id: module_.id });

      const activityRow = db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, activity.id))
        .get();

      expect(activityRow?.deletedAt?.getTime()).toBe(
        previouslyDeletedAt.getTime()
      );
    });

    it("does not overwrite the deletedAt of a flashcard that was already independently soft-deleted before", async () => {
      const module_ = await modulesClient.create({
        name: "Modulo 1",
        programId,
      });
      const activity = await activitiesClient.create({
        moduleId: module_.id,
        title: "Baralho",
        type: "flashcard_deck",
      });
      const flashcard = await flashcardsClient.create({
        activityId: activity.id,
        back: "Verso",
        front: "Frente",
      });
      const previouslyDeletedAt = new Date("2020-01-01T00:00:00Z");
      db.update(flashcardsTable)
        .set({ deletedAt: previouslyDeletedAt })
        .where(eq(flashcardsTable.id, flashcard.id))
        .run();

      await modulesClient.softDelete({ id: module_.id });

      const flashcardRow = db
        .select()
        .from(flashcardsTable)
        .where(eq(flashcardsTable.id, flashcard.id))
        .get();

      expect(flashcardRow?.deletedAt?.getTime()).toBe(
        previouslyDeletedAt.getTime()
      );
    });
  });
});
