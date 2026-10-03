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
import { countDueReviews } from "@/main/due-reviews";

/**
 * RED phase (Issue #20, Spec Driven TDD): src/main/due-reviews.ts does not
 * exist yet. Every test below is expected to fail until the Developer
 * implements countDueReviews, per docs/specs/issue-20-notificacao-boot.md
 * AC-3.
 *
 * countDueReviews mirrors the exact join/filter semantics review.listDue
 * and review.listSchedule already use (review_items inner join flashcards
 * where flashcards.deletedAt IS NULL), but combines listSchedule's scope
 * (global, no activityId filter) with listDue's due_date filter
 * (dueDate <= now) -- the "pending right now, across the whole app" count
 * the main process needs on boot to decide whether to fire a notification.
 * Unlike review.listDue/listSchedule, it is called directly against the
 * DatabaseClient from the main process (AC-3 is explicit this is NOT
 * exposed as an oRPC procedure), so it is exercised here as a plain
 * function call against a real test database, not through
 * createRouterClient.
 */

describe("countDueReviews (Issue #20)", () => {
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

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-due-reviews-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    reviewClient = createRouterClient(reviewNamespace);
    flashcardsClient = createRouterClient(flashcardsNamespace);
    activitiesClient = createRouterClient(activitiesNamespace);
    modulesClient = createRouterClient(modulesNamespace);
    programsClient = createRouterClient(programsNamespace);
  });

  afterEach(() => {
    // Windows refuses to delete a sqlite file while a connection to it is
    // still open (EPERM), unlike Linux/macOS -- close it first.
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  async function createDeck() {
    const program = await programsClient.create({ name: "Bacharelado II" });
    const module_ = await modulesClient.create({
      name: "Modulo 1",
      programId: program.id,
    });
    return await activitiesClient.create({
      moduleId: module_.id,
      title: "Baralho",
      type: "flashcard_deck",
    });
  }

  async function createFlashcardWithReviewItem(activityId: string) {
    const flashcard = await flashcardsClient.create({
      activityId,
      back: "Verso",
      front: "Frente",
    });
    await reviewClient.ensureReviewItems({ activityId });
    return flashcard;
  }

  it("returns 0 when there are no review_items", () => {
    expect(countDueReviews(db, new Date())).toBe(0);
  });

  it("counts a review_item whose dueDate is now or in the past", async () => {
    const deck = await createDeck();
    await createFlashcardWithReviewItem(deck.id);

    expect(countDueReviews(db, new Date())).toBe(1);
  });

  it("does not count a review_item whose dueDate is in the future", async () => {
    const deck = await createDeck();
    const flashcard = await createFlashcardWithReviewItem(deck.id);
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    db.update(reviewItemsTable)
      .set({ dueDate: future })
      .where(eq(reviewItemsTable.flashcardId, flashcard.id))
      .run();

    expect(countDueReviews(db, new Date())).toBe(0);
  });

  it("counts review_items across every activity, not scoped to one (global, like listSchedule)", async () => {
    const deckA = await createDeck();
    const deckB = await createDeck();
    await createFlashcardWithReviewItem(deckA.id);
    await createFlashcardWithReviewItem(deckB.id);

    expect(countDueReviews(db, new Date())).toBe(2);
  });

  it("excludes review_items whose flashcard has been soft-deleted", async () => {
    const deck = await createDeck();
    const flashcard = await createFlashcardWithReviewItem(deck.id);
    await flashcardsClient.softDelete({ id: flashcard.id });

    expect(countDueReviews(db, new Date())).toBe(0);
  });

  /**
   * RED phase (Issue #77, Spec Driven TDD): countDueReviews only counted
   * the Flashcard-scoped branch (inner join on flashcards) so far, which by
   * construction excludes any review_item whose flashcardId is null --
   * these cover the new Activity-scoped branch (quiz/pdf/link review_items,
   * created via review.markActivityDifficulty).
   */
  it("counts a due Activity-scoped review_item (quiz/pdf/link), not just Flashcard-scoped ones", async () => {
    const module_ = await modulesClient.create({
      name: "Modulo do Quiz",
      programId: (await programsClient.create({ name: "Prog Q" })).id,
    });
    const quiz = await activitiesClient.create({
      moduleId: module_.id,
      title: "Quiz",
      type: "quiz",
    });
    await reviewClient.markActivityDifficulty({
      activityId: quiz.id,
      rating: "good",
    });
    // markActivityDifficulty applies an FSRS rating immediately, which
    // schedules dueDate ahead -- push it back to "now" to isolate what
    // this test actually covers (the Activity-scoped join/filter), not
    // ts-fsrs's own scheduling interval for a first "good" review.
    db.update(reviewItemsTable)
      .set({ dueDate: new Date() })
      .where(eq(reviewItemsTable.activityId, quiz.id))
      .run();

    expect(countDueReviews(db, new Date())).toBe(1);
  });

  it("excludes an Activity-scoped review_item whose Activity was soft-deleted", async () => {
    const module_ = await modulesClient.create({
      name: "Modulo do Quiz",
      programId: (await programsClient.create({ name: "Prog Q" })).id,
    });
    const quiz = await activitiesClient.create({
      moduleId: module_.id,
      title: "Quiz",
      type: "quiz",
    });
    await reviewClient.markActivityDifficulty({
      activityId: quiz.id,
      rating: "good",
    });
    await activitiesClient.softDelete({ id: quiz.id });

    expect(countDueReviews(db, new Date())).toBe(0);
  });

  /** docs/specs/clarify-daily-count.md AC-5 */
  it("counts a deck with several due cards as one activity", async () => {
    const deck = await createDeck();
    await createFlashcardWithReviewItem(deck.id);
    await createFlashcardWithReviewItem(deck.id);

    expect(countDueReviews(db, new Date())).toBe(1);
  });

  it("counts what is due later today, like the Today screen", async () => {
    const deck = await createDeck();
    const flashcard = await createFlashcardWithReviewItem(deck.id);
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    const evening = new Date(morning);
    evening.setHours(22, 0, 0, 0);
    db.update(reviewItemsTable)
      .set({ dueDate: evening })
      .where(eq(reviewItemsTable.flashcardId, flashcard.id))
      .run();

    expect(countDueReviews(db, morning)).toBe(1);
  });

  it("uses the given 'now' for the comparison, not the real current time", async () => {
    const deck = await createDeck();
    const flashcard = await createFlashcardWithReviewItem(deck.id);
    const past = new Date("2020-01-01T00:00:00Z");
    db.update(reviewItemsTable)
      .set({ dueDate: past })
      .where(eq(reviewItemsTable.flashcardId, flashcard.id))
      .run();

    const earlierThanDueDate = new Date("2019-01-01T00:00:00Z");

    expect(countDueReviews(db, earlierThanDueDate)).toBe(0);
    expect(countDueReviews(db, new Date())).toBe(1);
  });
});
