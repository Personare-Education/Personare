import { sql } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";

/**
 * Fills what older data lacks for sequences and locks
 * (docs/specs/sequences-and-locks.md §1): the order lists showed (modules
 * by name, activities by creation) and each activity's completion, from its
 * first rating. Migration 0011 runs the same statements on upgrade; this
 * runs them after restoring a backup made before it.
 */
export function backfillSequenceData(db: DatabaseClient): void {
  db.run(
    sql`UPDATE modules SET position = (SELECT rn FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY program_id ORDER BY name) - 1 AS rn FROM modules) AS ordered WHERE ordered.id = modules.id)`
  );
  db.run(
    sql`UPDATE activities SET position = (SELECT rn FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY module_id, parent_activity_id ORDER BY created_at, rowid) - 1 AS rn FROM activities) AS ordered WHERE ordered.id = activities.id)`
  );
  db.run(
    sql`UPDATE activities SET completed_at = (SELECT MIN(r.last_reviewed_at) FROM review_items AS r LEFT JOIN flashcards AS f ON f.id = r.flashcard_id WHERE (r.activity_id = activities.id OR f.activity_id = activities.id) AND r.last_reviewed_at IS NOT NULL) WHERE completed_at IS NULL`
  );
}
