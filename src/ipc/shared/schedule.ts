import { eq, isNull, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
  modules as modulesTable,
  programs as programsTable,
  reviewItems as reviewItemsTable,
} from "@/database/schema";
import { loadLocks } from "@/ipc/shared/locks";
import { lockedActivityIds } from "@/utils/unlock";

/**
 * The review schedule and the days with ratings, shared by the review IPC
 * and the points (docs/specs/gamification.md §3), which reads them from
 * the main process.
 */

export function toLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function loadSchedule(db: DatabaseClient) {
  const viaFlashcard = db
    .select({
      activityFilePath: activitiesTable.filePath,
      activityId: activitiesTable.id,
      activityTitle: activitiesTable.title,
      activityType: activitiesTable.type,
      activityUrl: activitiesTable.url,
      dueDate: reviewItemsTable.dueDate,
      // Widened to string | null (flashcards.front is actually never null
      // here) only so this branch's shape matches viaActivity's for
      // unionAll -- Activity-scoped rows have no Flashcard to project a
      // front from.
      front: sql<string | null>`${flashcardsTable.front}`,
      id: reviewItemsTable.id,
      moduleId: modulesTable.id,
      moduleName: modulesTable.name,
      // The "Today" screen paints each item in its program's color
      // (docs/specs/today-review-queue.md).
      programColor: programsTable.color,
      programId: programsTable.id,
      programName: programsTable.name,
    })
    .from(reviewItemsTable)
    .innerJoin(
      flashcardsTable,
      eq(reviewItemsTable.flashcardId, flashcardsTable.id)
    )
    .innerJoin(
      activitiesTable,
      eq(flashcardsTable.activityId, activitiesTable.id)
    )
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(flashcardsTable.deletedAt));

  const viaActivity = db
    .select({
      activityFilePath: activitiesTable.filePath,
      activityId: activitiesTable.id,
      activityTitle: activitiesTable.title,
      activityType: activitiesTable.type,
      activityUrl: activitiesTable.url,
      dueDate: reviewItemsTable.dueDate,
      front: sql<string | null>`NULL`,
      id: reviewItemsTable.id,
      moduleId: modulesTable.id,
      moduleName: modulesTable.name,
      // The "Today" screen paints each item in its program's color
      // (docs/specs/today-review-queue.md).
      programColor: programsTable.color,
      programId: programsTable.id,
      programName: programsTable.name,
    })
    .from(reviewItemsTable)
    .innerJoin(
      activitiesTable,
      eq(reviewItemsTable.activityId, activitiesTable.id)
    )
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(activitiesTable.deletedAt));

  // What is locked waits until it unlocks: off Today, the badges and the
  // calendar (docs/specs/sequences-and-locks.md §2 AC-6).
  const locked = lockedActivityIds(loadLocks(db));
  return unionAll(viaFlashcard, viaActivity)
    .all()
    .filter((row) => !locked.has(row.activityId));
}

export function loadActivityCounts(db: DatabaseClient) {
  const viaFlashcard = db
    .select({
      activityId: activitiesTable.id,
      programId: programsTable.id,
      ratingHistory: reviewItemsTable.ratingHistory,
    })
    .from(reviewItemsTable)
    .innerJoin(
      flashcardsTable,
      eq(reviewItemsTable.flashcardId, flashcardsTable.id)
    )
    .innerJoin(
      activitiesTable,
      eq(flashcardsTable.activityId, activitiesTable.id)
    )
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(flashcardsTable.deletedAt));

  const viaActivity = db
    .select({
      activityId: activitiesTable.id,
      programId: programsTable.id,
      ratingHistory: reviewItemsTable.ratingHistory,
    })
    .from(reviewItemsTable)
    .innerJoin(
      activitiesTable,
      eq(reviewItemsTable.activityId, activitiesTable.id)
    )
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(activitiesTable.deletedAt));

  const rows = unionAll(viaFlashcard, viaActivity).all();

  // `count` is every rating (the heatmap's); `activities` each activity once
  // (docs/specs/clarify-daily-count.md AC-4).
  const byProgramAndDate = new Map<
    string,
    Map<string, { activities: Set<string>; count: number }>
  >();

  for (const row of rows) {
    const history = JSON.parse(row.ratingHistory) as { reviewedAt: number }[];

    for (const entry of history) {
      const dateKey = toLocalDateKey(new Date(entry.reviewedAt));
      const byDate =
        byProgramAndDate.get(row.programId) ??
        new Map<string, { activities: Set<string>; count: number }>();
      const day = byDate.get(dateKey) ?? {
        activities: new Set<string>(),
        count: 0,
      };
      day.count += 1;
      day.activities.add(row.activityId);
      byDate.set(dateKey, day);
      byProgramAndDate.set(row.programId, byDate);
    }
  }

  const result: {
    activities: number;
    count: number;
    date: string;
    programId: string;
  }[] = [];

  for (const [programId, byDate] of byProgramAndDate) {
    for (const [date, day] of byDate) {
      result.push({
        activities: day.activities.size,
        count: day.count,
        date,
        programId,
      });
    }
  }

  return result;
}
