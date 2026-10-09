import { eq } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
  modules as modulesTable,
  programs as programsTable,
} from "@/database/schema";
import type { StudyGoal } from "@/utils/study-goal";

export interface ReviewItemProgram {
  studyGoal: StudyGoal;
  targetDate: string | null;
}

/**
 * The goal of the program a review item belongs to
 * (docs/architecture/scheduling.md D1), through its flashcard or activity,
 * module and program. Null when the chain is broken.
 */
export function programOfReviewItem(
  db: DatabaseClient,
  item: { activityId: string | null; flashcardId: string | null }
): ReviewItemProgram | null {
  let { activityId } = item;
  if (!activityId && item.flashcardId) {
    activityId =
      db
        .select({ activityId: flashcardsTable.activityId })
        .from(flashcardsTable)
        .where(eq(flashcardsTable.id, item.flashcardId))
        .get()?.activityId ?? null;
  }
  if (!activityId) {
    return null;
  }
  return (
    db
      .select({
        studyGoal: programsTable.studyGoal,
        targetDate: programsTable.targetDate,
      })
      .from(activitiesTable)
      .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
      .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
      .where(eq(activitiesTable.id, activityId))
      .get() ?? null
  );
}
