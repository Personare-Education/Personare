import { and, eq, isNull, lt } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
  reviewItems as reviewItemsTable,
} from "@/database/schema";
import { loadLocks } from "@/ipc/shared/locks";
import { lockedActivityIds } from "@/utils/unlock";

/**
 * Activities with a review due until the end of `now`'s local day, a deck
 * counting once -- the same unit and cut-off as the Today screen
 * (docs/specs/clarify-daily-count.md AC-5). Walks the two review_items
 * origins (Issue #77): Flashcard-scoped (via the flashcard's deck) and
 * Activity-scoped (quiz/pdf/link), mirroring review.listSchedule's union.
 */
export function countDueReviews(db: DatabaseClient, now: Date): number {
  const endOfToday = new Date(now);
  endOfToday.setHours(24, 0, 0, 0);

  const viaFlashcard = db
    .selectDistinct({ activityId: flashcardsTable.activityId })
    .from(reviewItemsTable)
    .innerJoin(
      flashcardsTable,
      eq(reviewItemsTable.flashcardId, flashcardsTable.id)
    )
    .where(
      and(
        isNull(flashcardsTable.deletedAt),
        lt(reviewItemsTable.dueDate, endOfToday)
      )
    )
    .all();

  const viaActivity = db
    .selectDistinct({ activityId: activitiesTable.id })
    .from(reviewItemsTable)
    .innerJoin(
      activitiesTable,
      eq(reviewItemsTable.activityId, activitiesTable.id)
    )
    .where(
      and(
        isNull(activitiesTable.deletedAt),
        lt(reviewItemsTable.dueDate, endOfToday)
      )
    )
    .all();

  // Locked activities are not due yet (docs/specs/sequences-and-locks.md
  // §2 AC-6), the same as on Today.
  const locked = lockedActivityIds(loadLocks(db));
  return new Set(
    [...viaFlashcard, ...viaActivity]
      .map((row) => row.activityId)
      .filter((activityId) => !locked.has(activityId))
  ).size;
}
