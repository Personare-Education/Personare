import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { reviewItems as reviewItemsTable } from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { flashcards as flashcardsNamespace } from "@/ipc/flashcards";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { review as reviewNamespace } from "@/ipc/review";

/**
 * RED phase (Issue #16, Spec Driven TDD): src/ipc/review does not exist yet.
 * Every test below is expected to fail until the Developer implements the
 * "review" oRPC namespace, per docs/specs/issue-16-fsrs-review-session.md
 * AC-3. Exercises the full FSRS review lifecycle:
 *
 * - ensureReviewItems({ activityId }): idempotent, lazy creation of a
 *   review_items row (via src/utils/fsrs.ts's createInitialReviewItemFields)
 *   for every non-deleted flashcard of that Activity that doesn't have one
 *   yet.
 * - listDue({ activityId }): review_items whose dueDate <= now, scoped to
 *   non-deleted flashcards of that Activity, ordered by dueDate ascending,
 *   joined with the flashcard's front/back (no N+1 in the UI).
 * - submitRating({ reviewItemId, rating }): rating is one of the 4 strings
 *   "again"|"hard"|"good"|"easy" (never "manual"), validated before being
 *   mapped to the ts-fsrs Rating enum. Persists the fields AC-1 adds to
 *   review_items (state, reps, lapses, scheduledDays, learningSteps,
 *   lastReviewedAt) plus lastRating and an appended ratingHistory entry.
 *
 * Procedures are exercised through `createRouterClient`, oRPC's in-process
 * server-side client, exactly like every other *-ipc.test.ts in this suite.
 */

const REVIEW_ROUTER_REGISTRATION_PATTERN = /\breview\b/;

describe("review IPC namespace (Issue #16)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;
  let reviewClient: ReturnType<
    typeof createRouterClient<typeof reviewNamespace>
  >;
  let flashcardsClient: ReturnType<
    typeof createRouterClient<typeof flashcardsNamespace>
  >;
  let activitiesClient: ReturnType<
    typeof createRouterClient<typeof activitiesNamespace>
  >;
  let modulesClient: ReturnType<
    typeof createRouterClient<typeof modulesNamespace>
  >;
  let programsClient: ReturnType<
    typeof createRouterClient<typeof programsNamespace>
  >;
  let activityId: string;
  let otherActivityId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-review-ipc-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    reviewClient = createRouterClient(reviewNamespace);
    flashcardsClient = createRouterClient(flashcardsNamespace);
    activitiesClient = createRouterClient(activitiesNamespace);
    modulesClient = createRouterClient(modulesNamespace);
    programsClient = createRouterClient(programsNamespace);

    const program = await programsClient.create({ name: "Bacharelado II" });
    const createdModule = await modulesClient.create({
      name: "Modulo 1",
      programId: program.id,
    });
    const activity = await activitiesClient.create({
      moduleId: createdModule.id,
      title: "Baralho de Revisao",
      type: "flashcard_deck",
    });
    activityId = activity.id;
    const otherActivity = await activitiesClient.create({
      moduleId: createdModule.id,
      title: "Outro Baralho",
      type: "flashcard_deck",
    });
    otherActivityId = otherActivity.id;
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

    expect(routerSource).toMatch(REVIEW_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes ensureReviewItems, listDue and submitRating procedures", () => {
    expect(reviewNamespace.ensureReviewItems).toBeDefined();
    expect(reviewNamespace.listDue).toBeDefined();
    expect(reviewNamespace.submitRating).toBeDefined();
  });

  describe("ensureReviewItems", () => {
    it("creates a review_items row for every flashcard that does not have one yet", async () => {
      const first = await flashcardsClient.create({
        activityId,
        back: "Verso 1",
        front: "Frente 1",
      });
      const second = await flashcardsClient.create({
        activityId,
        back: "Verso 2",
        front: "Frente 2",
      });

      await reviewClient.ensureReviewItems({ activityId });

      const rows = db.select().from(reviewItemsTable).all();
      expect(rows.map((row) => row.flashcardId)).toEqual(
        expect.arrayContaining([first.id, second.id])
      );
      expect(rows).toHaveLength(2);
    });

    it("initializes a new review_item with a brand-new ts-fsrs card's fields", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });

      await reviewClient.ensureReviewItems({ activityId });

      const row = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .get();

      expect(row?.state).toBe("New");
      expect(row?.reps).toBe(0);
      expect(row?.lapses).toBe(0);
      expect(row?.scheduledDays).toBe(0);
      expect(row?.learningSteps).toBe(0);
      expect(row?.lastReviewedAt).toBeNull();
      expect(row?.dueDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("is idempotent -- calling it again does not create a duplicate review_item for the same flashcard", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });

      await reviewClient.ensureReviewItems({ activityId });
      await reviewClient.ensureReviewItems({ activityId });

      const rows = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .all();
      expect(rows).toHaveLength(1);
    });

    it("does not create a review_item for a soft-deleted flashcard", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });
      await flashcardsClient.softDelete({ id: flashcard.id });

      await reviewClient.ensureReviewItems({ activityId });

      const rows = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("only creates review_items for flashcards belonging to the given activity", async () => {
      const inActivity = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Deste baralho",
      });
      const inOtherActivity = await flashcardsClient.create({
        activityId: otherActivityId,
        back: "Verso",
        front: "De outro baralho",
      });

      await reviewClient.ensureReviewItems({ activityId });

      const rows = db.select().from(reviewItemsTable).all();
      expect(rows.map((row) => row.flashcardId)).toContain(inActivity.id);
      expect(rows.map((row) => row.flashcardId)).not.toContain(
        inOtherActivity.id
      );
    });

    /**
     * RED phase (Issue #18, Spec Driven TDD): ensureReviewItemsInputSchema
     * does not accept an omitted activityId yet -- these tests are expected
     * to fail until the Developer makes it optional and, when omitted,
     * covers every non-deleted flashcard in the app instead of scoping to
     * one Activity (docs/specs/issue-18-calendario.md, AC-2). This is what
     * lets a Flashcard Deck that was never opened for review still show up
     * on the calendar.
     */
    it("covers flashcards from every activity when activityId is omitted", async () => {
      const inFirstActivity = await flashcardsClient.create({
        activityId,
        back: "Verso 1",
        front: "Frente 1",
      });
      const inOtherActivity = await flashcardsClient.create({
        activityId: otherActivityId,
        back: "Verso 2",
        front: "Frente 2",
      });

      await reviewClient.ensureReviewItems({});

      const rows = db.select().from(reviewItemsTable).all();
      expect(rows.map((row) => row.flashcardId)).toEqual(
        expect.arrayContaining([inFirstActivity.id, inOtherActivity.id])
      );
    });

    it("does not create a review_item for a soft-deleted flashcard, even when activityId is omitted", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });
      await flashcardsClient.softDelete({ id: flashcard.id });

      await reviewClient.ensureReviewItems({});

      const rows = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("remains idempotent across a global call after a scoped call already created the review_item", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });

      await reviewClient.ensureReviewItems({ activityId });
      await reviewClient.ensureReviewItems({});

      const rows = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .all();
      expect(rows).toHaveLength(1);
    });
  });

  describe("listDue", () => {
    it("returns an empty array when the activity has no review_items", async () => {
      await expect(reviewClient.listDue({ activityId })).resolves.toEqual([]);
    });

    it("returns a review_item that is immediately due, right after ensureReviewItems creates it", async () => {
      await flashcardsClient.create({
        activityId,
        back: "Capital do Brasil",
        front: "Brasilia",
      });
      await reviewClient.ensureReviewItems({ activityId });

      const due = await reviewClient.listDue({ activityId });

      expect(due).toHaveLength(1);
      expect(due[0].front).toBe("Brasilia");
      expect(due[0].back).toBe("Capital do Brasil");
    });

    it("excludes review_items whose dueDate is in the future", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });
      await reviewClient.ensureReviewItems({ activityId });

      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      db.update(reviewItemsTable)
        .set({ dueDate: future })
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .run();

      await expect(reviewClient.listDue({ activityId })).resolves.toEqual([]);
    });

    it("orders due review_items by dueDate ascending", async () => {
      const first = await flashcardsClient.create({
        activityId,
        back: "Verso 1",
        front: "Frente 1",
      });
      const second = await flashcardsClient.create({
        activityId,
        back: "Verso 2",
        front: "Frente 2",
      });
      await reviewClient.ensureReviewItems({ activityId });

      const now = Date.now();
      db.update(reviewItemsTable)
        .set({ dueDate: new Date(now - 1000) })
        .where(eq(reviewItemsTable.flashcardId, second.id))
        .run();
      db.update(reviewItemsTable)
        .set({ dueDate: new Date(now - 2000) })
        .where(eq(reviewItemsTable.flashcardId, first.id))
        .run();

      const due = await reviewClient.listDue({ activityId });

      expect(due.map((item) => item.front)).toEqual(["Frente 1", "Frente 2"]);
    });

    it("only returns review_items for flashcards belonging to the given activity", async () => {
      await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Deste baralho",
      });
      await flashcardsClient.create({
        activityId: otherActivityId,
        back: "Verso",
        front: "De outro baralho",
      });
      await reviewClient.ensureReviewItems({ activityId });
      await reviewClient.ensureReviewItems({ activityId: otherActivityId });

      const due = await reviewClient.listDue({ activityId });

      expect(due.map((item) => item.front)).toEqual(["Deste baralho"]);
    });

    it("excludes review_items whose flashcard has been soft-deleted", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });
      await reviewClient.ensureReviewItems({ activityId });
      await flashcardsClient.softDelete({ id: flashcard.id });

      await expect(reviewClient.listDue({ activityId })).resolves.toEqual([]);
    });

    it("includes the flashcard's frontImagePath and backImagePath (Issue #96)", async () => {
      await flashcardsClient.create({
        activityId,
        back: "Verso",
        backImagePath: "back123.png",
        front: "Frente",
        frontImagePath: "front123.png",
      });
      await reviewClient.ensureReviewItems({ activityId });

      const [due] = await reviewClient.listDue({ activityId });

      expect(due.frontImagePath).toBe("front123.png");
      expect(due.backImagePath).toBe("back123.png");
    });
  });

  describe("submitRating", () => {
    async function createDueReviewItem() {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Capital do Brasil",
        front: "Brasilia",
      });
      await reviewClient.ensureReviewItems({ activityId });
      const [due] = await reviewClient.listDue({ activityId });
      return { due, flashcard };
    }

    it("rejects a rating outside again/hard/good/easy", async () => {
      const { due } = await createDueReviewItem();

      await expect(
        reviewClient.submitRating({ rating: "manual", reviewItemId: due.id })
      ).rejects.toThrow();
      await expect(
        reviewClient.submitRating({
          rating: "excellent",
          reviewItemId: due.id,
        })
      ).rejects.toThrow();
    });

    it.each(["again", "hard", "good", "easy"] as const)(
      "accepts the %s rating",
      async (rating) => {
        const { due } = await createDueReviewItem();

        await expect(
          reviewClient.submitRating({ rating, reviewItemId: due.id })
        ).resolves.toBeDefined();
      }
    );

    it("persists the updated ts-fsrs scheduling fields onto the review_item", async () => {
      const { due, flashcard } = await createDueReviewItem();

      await reviewClient.submitRating({
        rating: "good",
        reviewItemId: due.id,
      });

      const row = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .get();

      expect(row?.reps).toBe(1);
      expect(row?.state).not.toBe("New");
      expect(row?.lastReviewedAt).not.toBeNull();
      expect(row?.dueDate.getTime()).toBeGreaterThan(due.dueDate.getTime());
    });

    it("updates lastRating to the applied rating", async () => {
      const { due, flashcard } = await createDueReviewItem();

      await reviewClient.submitRating({
        rating: "easy",
        reviewItemId: due.id,
      });

      const row = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .get();

      expect(row?.lastRating).toBe("easy");
    });

    it("appends the rating and timestamp to ratingHistory, keeping prior entries", async () => {
      const { due, flashcard } = await createDueReviewItem();

      await reviewClient.submitRating({
        rating: "good",
        reviewItemId: due.id,
      });

      const row = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .get();

      const history = JSON.parse(row?.ratingHistory ?? "[]") as {
        rating: string;
        reviewedAt: number;
      }[];
      expect(history).toHaveLength(1);
      expect(history[0].rating).toBe("good");
      expect(typeof history[0].reviewedAt).toBe("number");
    });

    it("removes the reviewed item from a subsequent listDue call until it becomes due again", async () => {
      const { due } = await createDueReviewItem();

      await reviewClient.submitRating({
        rating: "good",
        reviewItemId: due.id,
      });

      await expect(reviewClient.listDue({ activityId })).resolves.toEqual([]);
    });

    it("returns the updated review_item row", async () => {
      const { due } = await createDueReviewItem();

      const updated = await reviewClient.submitRating({
        rating: "good",
        reviewItemId: due.id,
      });

      expect(updated.id).toBe(due.id);
    });
  });

  /**
   * RED phase (Issue #77, Spec Driven TDD): src/ipc/review does not expose
   * a `markActivityDifficulty` procedure yet. Unlike Flashcard review
   * (per-Flashcard review_items, created lazily by ensureReviewItems and
   * rated one at a time via submitRating), a quiz/pdf/link Activity gets
   * exactly one review_item for the whole Activity, get-or-created and
   * rated in the same call -- there is no separate "ensure" step, since the
   * only way this review_item is ever created is the user marking the
   * Activity done with a rating.
   */
  /**
   * docs/specs/rating-clarity.md AC-1: what each rating would schedule,
   * computed with the same scheduler the save uses.
   */
  describe("previewRatings", () => {
    it("previews an activity never rated, in whole days", async () => {
      const preview = await reviewClient.previewRatings({ activityId });

      expect(Object.keys(preview).sort()).toEqual([
        "again",
        "easy",
        "good",
        "hard",
      ]);
      expect(preview.good.getTime()).toBeGreaterThan(Date.now());
    });

    it("previews an existing flashcard review item", async () => {
      await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });
      await reviewClient.ensureReviewItems({ activityId });
      const [item] = await reviewClient.listDue({ activityId });

      const preview = await reviewClient.previewRatings({
        reviewItemId: item.id,
      });

      expect(preview.easy.getTime()).toBeGreaterThan(preview.again.getTime());
    });
  });

  describe("markActivityDifficulty", () => {
    async function createQuizActivity() {
      const created = await activitiesClient.create({
        moduleId: (
          await modulesClient.create({
            name: "Modulo do Quiz",
            programId: (await programsClient.create({ name: "Programa X" })).id,
          })
        ).id,
        title: "Quiz de Historia",
        type: "quiz",
      });
      return created;
    }

    it("creates a review_item scoped to the Activity (activityId, no flashcardId) on the first call", async () => {
      const quiz = await createQuizActivity();

      await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "good",
      });

      const rows = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.activityId, quiz.id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0].flashcardId).toBeNull();
      expect(rows[0].lastRating).toBe("good");
    });

    it("applies the FSRS rating immediately -- the first mark is a real review, not just creation", async () => {
      const quiz = await createQuizActivity();

      const updated = await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "good",
      });

      expect(updated.reps).toBe(1);
      expect(updated.state).not.toBe("New");
      expect(updated.lastReviewedAt).not.toBeNull();
    });

    /**
     * Regression: the default ts-fsrs scheduler (enable_short_term: true,
     * used by Flashcard review) treats a first "good"/"easy" rating as a
     * short-term learning step, scheduling the next due date minutes away
     * -- confusing for a one-shot "I just finished this Activity" rating,
     * reported as a strange same-day/2-day reschedule on a second mark.
     * markActivityDifficulty passes shortTermEnabled: false so even the
     * very first rating graduates straight to a real, whole-day interval.
     */
    it("schedules a real multi-day interval on the very first mark, not a short-term learning step minutes away", async () => {
      const quiz = await createQuizActivity();

      const updated = await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "good",
      });

      const hoursUntilDue =
        (updated.dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursUntilDue).toBeGreaterThanOrEqual(24);
    });

    it("reuses the same review_item on a second call, applying the new rating on top of the FSRS state instead of creating a duplicate", async () => {
      const quiz = await createQuizActivity();

      await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "good",
      });
      await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "easy",
      });

      const rows = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.activityId, quiz.id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0].reps).toBe(2);
      expect(rows[0].lastRating).toBe("easy");
    });

    it("rejects a rating outside again/hard/good/easy", async () => {
      const quiz = await createQuizActivity();

      await expect(
        reviewClient.markActivityDifficulty({
          activityId: quiz.id,
          rating: "manual",
        })
      ).rejects.toThrow();
    });

    it("keeps each Activity's review_item independent from another Activity's", async () => {
      const first = await createQuizActivity();
      const second = await createQuizActivity();

      await reviewClient.markActivityDifficulty({
        activityId: first.id,
        rating: "again",
      });
      await reviewClient.markActivityDifficulty({
        activityId: second.id,
        rating: "easy",
      });

      const rows = db.select().from(reviewItemsTable).all();
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.lastRating).sort()).toEqual([
        "again",
        "easy",
      ]);
    });
  });

  describe("listActivityReviewState", () => {
    async function createQuizActivity(moduleId: string, title: string) {
      return await activitiesClient.create({ moduleId, title, type: "quiz" });
    }

    it("returns an empty array when no Activity in the module has been marked yet", async () => {
      const program = await programsClient.create({ name: "Programa Y" });
      const module_ = await modulesClient.create({
        name: "Modulo Y",
        programId: program.id,
      });

      await expect(
        reviewClient.listActivityReviewState({ moduleId: module_.id })
      ).resolves.toEqual([]);
    });

    it("returns the activityId, lastRating and dueDate for a marked Activity in the module", async () => {
      const program = await programsClient.create({ name: "Programa Y" });
      const module_ = await modulesClient.create({
        name: "Modulo Y",
        programId: program.id,
      });
      const quiz = await createQuizActivity(module_.id, "Quiz 1");
      await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "hard",
      });

      const state = await reviewClient.listActivityReviewState({
        moduleId: module_.id,
      });

      expect(state).toHaveLength(1);
      expect(state[0].activityId).toBe(quiz.id);
      expect(state[0].lastRating).toBe("hard");
      expect(state[0].dueDate).toBeInstanceOf(Date);
    });

    it("does not return review state for Activities in a different module", async () => {
      const program = await programsClient.create({ name: "Programa Y" });
      const moduleA = await modulesClient.create({
        name: "Modulo A",
        programId: program.id,
      });
      const moduleB = await modulesClient.create({
        name: "Modulo B",
        programId: program.id,
      });
      const quizInB = await createQuizActivity(moduleB.id, "Quiz de B");
      await reviewClient.markActivityDifficulty({
        activityId: quizInB.id,
        rating: "good",
      });

      await expect(
        reviewClient.listActivityReviewState({ moduleId: moduleA.id })
      ).resolves.toEqual([]);
    });

    it("excludes a soft-deleted Activity", async () => {
      const program = await programsClient.create({ name: "Programa Y" });
      const module_ = await modulesClient.create({
        name: "Modulo Y",
        programId: program.id,
      });
      const quiz = await createQuizActivity(module_.id, "Quiz 1");
      await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "good",
      });
      await activitiesClient.softDelete({ id: quiz.id });

      await expect(
        reviewClient.listActivityReviewState({ moduleId: module_.id })
      ).resolves.toEqual([]);
    });
  });

  /**
   * RED phase (Issue #18, Spec Driven TDD): src/ipc/review does not expose
   * a `listSchedule` procedure yet. Every test below is expected to fail
   * until the Developer implements it, per
   * docs/specs/issue-18-calendario.md AC-2. Unlike `listDue` (which this
   * issue leaves completely untouched -- it stays scoped to one Activity
   * and only the already-due items, for the review session), `listSchedule`
   * takes no input, returns every review_item regardless of dueDate (the
   * calendar needs to show future revisions too), and joins all the way up
   * to modules/programs so the calendar can navigate back to the source
   * Module on a click.
   */
  describe("listSchedule", () => {
    it("is exposed as a procedure on the review namespace", () => {
      expect(reviewNamespace.listSchedule).toBeDefined();
    });

    it("returns an empty array when there are no review_items", async () => {
      await expect(reviewClient.listSchedule()).resolves.toEqual([]);
    });

    it("returns review_items regardless of due_date, unlike listDue", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Capital do Brasil",
        front: "Brasilia",
      });
      await reviewClient.ensureReviewItems({ activityId });

      // dueDate is stored via drizzle-orm's integer "timestamp" mode, which
      // SQLite truncates to whole seconds on write (pre-existing precision
      // loss across every write since the foundational migration, tracked
      // separately as Issue #64 -- not something this issue's schema
      // introduces or should fix). Aligning the fixture to an exact second
      // up front keeps this assertion about listSchedule's due_date-agnostic
      // behavior, not about sub-second timestamp precision.
      const future = new Date(
        Math.floor((Date.now() + 1000 * 60 * 60 * 24 * 30) / 1000) * 1000
      );
      db.update(reviewItemsTable)
        .set({ dueDate: future })
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .run();

      const schedule = await reviewClient.listSchedule();

      expect(schedule).toHaveLength(1);
      expect(schedule[0].front).toBe("Brasilia");
      expect(schedule[0].dueDate.getTime()).toBe(future.getTime());
    });

    it("includes activityId, activityTitle, moduleId and programId for navigation, joined from the content hierarchy", async () => {
      await flashcardsClient.create({
        activityId,
        back: "Capital do Brasil",
        front: "Brasilia",
      });
      await reviewClient.ensureReviewItems({ activityId });

      const [scheduled] = await reviewClient.listSchedule();

      expect(scheduled.activityId).toBe(activityId);
      expect(scheduled.activityTitle).toBe("Baralho de Revisao");
      expect(scheduled.moduleId).toBeTruthy();
      expect(scheduled.programId).toBeTruthy();
    });

    /**
     * docs/specs/today-review-queue.md: the "Today" screen opens each item
     * (a PDF's file, a link's URL), tells decks apart and paints it in its
     * program's color, all from this one list.
     */
    it("includes the activity's type, URL and file, and the program's name and color", async () => {
      await flashcardsClient.create({
        activityId,
        back: "Capital do Brasil",
        front: "Brasilia",
      });
      await reviewClient.ensureReviewItems({ activityId });

      const [scheduled] = await reviewClient.listSchedule();

      expect(scheduled).toMatchObject({
        activityFilePath: null,
        activityType: "flashcard_deck",
        activityUrl: null,
        programColor: null,
        programName: "Bacharelado II",
      });
    });

    it("carries an activity-scoped row's type and URL too", async () => {
      const program = await programsClient.create({
        color: "#22c55e",
        name: "Programa Link",
      });
      const module = await modulesClient.create({
        name: "Modulo Link",
        programId: program.id,
      });
      const link = await activitiesClient.create({
        filePath: null,
        moduleId: module.id,
        title: "Aula",
        type: "link",
        url: "https://example.com/aula",
      });
      await reviewClient.markActivityDifficulty({
        activityId: link.id,
        rating: "good",
      });

      const scheduled = (await reviewClient.listSchedule()).find(
        (item) => item.activityId === link.id
      );

      expect(scheduled).toMatchObject({
        activityType: "link",
        activityUrl: "https://example.com/aula",
        programColor: "#22c55e",
        programName: "Programa Link",
      });
    });

    it("returns review_items across every activity, not scoped to one", async () => {
      await flashcardsClient.create({
        activityId,
        back: "Verso 1",
        front: "Frente 1",
      });
      await flashcardsClient.create({
        activityId: otherActivityId,
        back: "Verso 2",
        front: "Frente 2",
      });
      await reviewClient.ensureReviewItems({});

      const schedule = await reviewClient.listSchedule();

      expect(schedule.map((item) => item.front)).toEqual(
        expect.arrayContaining(["Frente 1", "Frente 2"])
      );
    });

    it("excludes review_items whose flashcard has been soft-deleted", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });
      await reviewClient.ensureReviewItems({ activityId });
      await flashcardsClient.softDelete({ id: flashcard.id });

      await expect(reviewClient.listSchedule()).resolves.toEqual([]);
    });

    /**
     * RED phase (Issue #22, Spec Driven TDD): this is the concrete,
     * reproducible bug documented in
     * docs/specs/issue-22-cascata-soft-delete.md -- modules.softDelete does
     * not cascade to its activities/flashcards yet, so a deleted Module's
     * pending flashcards keep showing up on the Calendar (Issue #18)
     * indefinitely, with no navigation path back to them in the UI.
     * listSchedule itself is correct (it already filters on
     * flashcards.deletedAt) -- the bug is entirely in the missing cascade.
     */
    it("excludes review_items whose flashcard's Module was soft-deleted, closing the original Issue #18 calendar bug", async () => {
      const program = await programsClient.create({ name: "Outro Programa" });
      const moduleToDelete = await modulesClient.create({
        name: "Modulo a ser removido",
        programId: program.id,
      });
      const deck = await activitiesClient.create({
        moduleId: moduleToDelete.id,
        title: "Baralho a ser removido",
        type: "flashcard_deck",
      });
      await flashcardsClient.create({
        activityId: deck.id,
        back: "Verso",
        front: "Frente",
      });
      await reviewClient.ensureReviewItems({ activityId: deck.id });

      const beforeDelete = await reviewClient.listSchedule();
      expect(beforeDelete.map((item) => item.activityId)).toContain(deck.id);

      await modulesClient.softDelete({ id: moduleToDelete.id });

      const afterDelete = await reviewClient.listSchedule();
      expect(afterDelete.map((item) => item.activityId)).not.toContain(deck.id);
    });

    /**
     * RED phase (Issue #99, Spec Driven TDD): src/ipc/review does not expose
     * a `listActivityCounts` procedure yet. Per
     * docs/specs/issue-99-programs-cards-heatmap.md AC-1, this powers the
     * Programs page's per-card activity heatmap: one row per
     * program/day-with-at-least-one-rating, `date` a local "yyyy-MM-dd" key
     * (not UTC), derived from every `ratingHistory` entry reachable from
     * that program (same Flashcard-scoped/Activity-scoped union as
     * listSchedule above).
     */
    describe("listActivityCounts", () => {
      function todayDateKey(): string {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${now.getFullYear()}-${month}-${day}`;
      }

      it("is exposed as a procedure on the review namespace", () => {
        expect(reviewNamespace.listActivityCounts).toBeDefined();
      });

      it("returns an empty array when there are no ratings yet", async () => {
        await expect(reviewClient.listActivityCounts()).resolves.toEqual([]);
      });

      it("counts a Flashcard-scoped rating toward its program, keyed by the local day it was recorded", async () => {
        const program = await programsClient.create({ name: "Programa H1" });
        const moduleRow = await modulesClient.create({
          name: "Modulo H1",
          programId: program.id,
        });
        const activity = await activitiesClient.create({
          moduleId: moduleRow.id,
          title: "Baralho H1",
          type: "flashcard_deck",
        });
        await flashcardsClient.create({
          activityId: activity.id,
          back: "Verso",
          front: "Frente",
        });
        await reviewClient.ensureReviewItems({ activityId: activity.id });
        const [due] = await reviewClient.listDue({ activityId: activity.id });
        await reviewClient.submitRating({
          rating: "good",
          reviewItemId: due.id,
        });

        const counts = await reviewClient.listActivityCounts();

        expect(counts).toEqual([
          {
            activities: 1,
            count: 1,
            date: todayDateKey(),
            programId: program.id,
          },
        ]);
      });

      it("counts an Activity-scoped rating (quiz/pdf/link) toward its program too", async () => {
        const program = await programsClient.create({ name: "Programa H2" });
        const moduleRow = await modulesClient.create({
          name: "Modulo H2",
          programId: program.id,
        });
        const quiz = await activitiesClient.create({
          moduleId: moduleRow.id,
          title: "Quiz H2",
          type: "quiz",
        });
        await reviewClient.markActivityDifficulty({
          activityId: quiz.id,
          rating: "good",
        });

        const counts = await reviewClient.listActivityCounts();

        expect(counts).toEqual([
          {
            activities: 1,
            count: 1,
            date: todayDateKey(),
            programId: program.id,
          },
        ]);
      });

      it("aggregates multiple ratings on the same day under one program into a single count, the deck once in activities (docs/specs/clarify-daily-count.md AC-4)", async () => {
        const program = await programsClient.create({ name: "Programa H3" });
        const moduleRow = await modulesClient.create({
          name: "Modulo H3",
          programId: program.id,
        });
        const activity = await activitiesClient.create({
          moduleId: moduleRow.id,
          title: "Baralho H3",
          type: "flashcard_deck",
        });
        await flashcardsClient.create({
          activityId: activity.id,
          back: "Verso 1",
          front: "Frente 1",
        });
        await flashcardsClient.create({
          activityId: activity.id,
          back: "Verso 2",
          front: "Frente 2",
        });
        await reviewClient.ensureReviewItems({ activityId: activity.id });
        const due = await reviewClient.listDue({ activityId: activity.id });
        await reviewClient.submitRating({
          rating: "good",
          reviewItemId: due[0].id,
        });
        await reviewClient.submitRating({
          rating: "easy",
          reviewItemId: due[1].id,
        });

        const counts = await reviewClient.listActivityCounts();

        expect(counts).toEqual([
          {
            activities: 1,
            count: 2,
            date: todayDateKey(),
            programId: program.id,
          },
        ]);
      });

      it("keeps counts for different programs separate", async () => {
        const firstProgram = await programsClient.create({
          name: "Programa H4",
        });
        const firstModule = await modulesClient.create({
          name: "Modulo H4",
          programId: firstProgram.id,
        });
        const firstQuiz = await activitiesClient.create({
          moduleId: firstModule.id,
          title: "Quiz H4",
          type: "quiz",
        });
        const secondProgram = await programsClient.create({
          name: "Programa H5",
        });
        const secondModule = await modulesClient.create({
          name: "Modulo H5",
          programId: secondProgram.id,
        });
        const secondQuiz = await activitiesClient.create({
          moduleId: secondModule.id,
          title: "Quiz H5",
          type: "quiz",
        });

        await reviewClient.markActivityDifficulty({
          activityId: firstQuiz.id,
          rating: "good",
        });
        await reviewClient.markActivityDifficulty({
          activityId: secondQuiz.id,
          rating: "easy",
        });

        const counts = await reviewClient.listActivityCounts();

        expect(counts).toEqual(
          expect.arrayContaining([
            {
              activities: 1,
              count: 1,
              date: todayDateKey(),
              programId: firstProgram.id,
            },
            {
              activities: 1,
              count: 1,
              date: todayDateKey(),
              programId: secondProgram.id,
            },
          ])
        );
        expect(counts).toHaveLength(2);
      });
    });

    /**
     * RED phase (Issue #77, Spec Driven TDD): listSchedule only unions the
     * Flashcard-scoped branch so far -- these cover the new Activity-scoped
     * branch (quiz/pdf/link review_items, no flashcardId) added alongside
     * markActivityDifficulty.
     */
    it("includes an Activity-scoped review_item (quiz/pdf/link), with front null since there is no Flashcard", async () => {
      const quiz = await activitiesClient.create({
        moduleId: (
          await modulesClient.create({
            name: "Modulo do Quiz",
            programId: (await programsClient.create({ name: "Prog Z" })).id,
          })
        ).id,
        title: "Quiz de Geografia",
        type: "quiz",
      });
      await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "good",
      });

      const schedule = await reviewClient.listSchedule();

      expect(schedule).toHaveLength(1);
      expect(schedule[0].activityId).toBe(quiz.id);
      expect(schedule[0].activityTitle).toBe("Quiz de Geografia");
      expect(schedule[0].front).toBeNull();
    });

    it("excludes an Activity-scoped review_item whose Activity was soft-deleted", async () => {
      const quiz = await activitiesClient.create({
        moduleId: (
          await modulesClient.create({
            name: "Modulo do Quiz",
            programId: (await programsClient.create({ name: "Prog Z" })).id,
          })
        ).id,
        title: "Quiz de Geografia",
        type: "quiz",
      });
      await reviewClient.markActivityDifficulty({
        activityId: quiz.id,
        rating: "good",
      });
      await activitiesClient.softDelete({ id: quiz.id });

      await expect(reviewClient.listSchedule()).resolves.toEqual([]);
    });
  });

  /**
   * RED phase (Issue #103, Spec Driven TDD): src/ipc/review does not expose
   * armPendingActivityRating/clearPendingActivityRating/
   * getPendingActivityRating yet. Every test below is expected to fail
   * until the Developer implements them, per
   * docs/specs/issue-103-pdf-native-open-difficulty-flow.md AC-3.
   */
  describe("pending activity ratings (Issue #103)", () => {
    async function createActivity(title: string) {
      const program = await programsClient.create({
        name: `Programa ${title}`,
      });
      const moduleRow = await modulesClient.create({
        name: `Modulo ${title}`,
        programId: program.id,
      });
      const activity = await activitiesClient.create({
        moduleId: moduleRow.id,
        title,
        type: "pdf",
      });
      return { activity, moduleRow, program };
    }

    it("is exposed as procedures on the review namespace", () => {
      expect(reviewNamespace.armPendingActivityRating).toBeDefined();
      expect(reviewNamespace.clearPendingActivityRating).toBeDefined();
      expect(reviewNamespace.getPendingActivityRating).toBeDefined();
    });

    it("returns null when there is nothing pending", async () => {
      await expect(reviewClient.getPendingActivityRating()).resolves.toBeNull();
    });

    it("returns the activity/module/program names for a pending rating", async () => {
      const { activity, moduleRow, program } =
        await createActivity("Apostila em PDF");

      await reviewClient.armPendingActivityRating({ activityId: activity.id });

      await expect(reviewClient.getPendingActivityRating()).resolves.toEqual({
        activityId: activity.id,
        activityTitle: "Apostila em PDF",
        moduleName: moduleRow.name,
        programName: program.name,
      });
    });

    it("is idempotent -- arming the same activity twice does not error or duplicate", async () => {
      const { activity } = await createActivity("Apostila em PDF");

      await reviewClient.armPendingActivityRating({ activityId: activity.id });
      await reviewClient.armPendingActivityRating({ activityId: activity.id });

      const pending = await reviewClient.getPendingActivityRating();
      expect(pending?.activityId).toBe(activity.id);
    });

    it("returns the oldest pending activity when more than one is armed", async () => {
      const first = await createActivity("Primeira");
      const second = await createActivity("Segunda");

      await reviewClient.armPendingActivityRating({
        activityId: first.activity.id,
      });
      await reviewClient.armPendingActivityRating({
        activityId: second.activity.id,
      });

      const pending = await reviewClient.getPendingActivityRating();
      expect(pending?.activityId).toBe(first.activity.id);
    });

    it("clears the pending rating so it no longer surfaces", async () => {
      const { activity } = await createActivity("Apostila em PDF");
      await reviewClient.armPendingActivityRating({ activityId: activity.id });

      await reviewClient.clearPendingActivityRating({
        activityId: activity.id,
      });

      await expect(reviewClient.getPendingActivityRating()).resolves.toBeNull();
    });

    it("excludes a pending rating for a soft-deleted activity", async () => {
      const { activity } = await createActivity("Apostila em PDF");
      await reviewClient.armPendingActivityRating({ activityId: activity.id });

      await activitiesClient.softDelete({ id: activity.id });

      await expect(reviewClient.getPendingActivityRating()).resolves.toBeNull();
    });
  });
});
