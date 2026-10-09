import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";

/**
 * docs/specs/database-indexes.md: every column the app joins or filters
 * on leads an index, so the lists, the day's reviews and the points don't
 * scan whole tables once a big Anki deck is imported.
 */

const EXPECTED: [table: string, column: string][] = [
  ["modules", "program_id"],
  ["activities", "module_id"],
  ["activities", "parent_activity_id"],
  ["unlock_requirements", "subject_id"],
  ["unlock_requirements", "required_id"],
  ["quiz_questions", "activity_id"],
  ["quiz_questions", "exam_id"],
  ["quiz_options", "question_id"],
  ["flashcards", "activity_id"],
  ["exams", "program_id"],
  ["exam_modules", "exam_id"],
  ["exam_modules", "module_id"],
  ["exam_attempts", "exam_id"],
  ["point_events", "season"],
  ["point_events", "source_id"],
  ["review_items", "due_date"],
  ["review_items", "flashcard_id"],
  ["review_items", "activity_id"],
];

const FULL_SCAN_OF_REVIEW_ITEMS = /SCAN review_items\b(?! USING)/;

let db: DatabaseClient;

beforeEach(() => {
  db = createDatabaseClient(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.$client.close();
});

/** The first column of each index on the table. */
function leadingIndexedColumns(table: string): string[] {
  const indexes = db.$client.prepare(`PRAGMA index_list(${table})`).all() as {
    name: string;
  }[];
  return indexes.map((index) => {
    const [first] = db.$client
      .prepare(`PRAGMA index_info(${index.name})`)
      .all() as { name: string }[];
    return first.name;
  });
}

function queryPlan(sqlText: string): string {
  const rows = db.$client.prepare(`EXPLAIN QUERY PLAN ${sqlText}`).all() as {
    detail: string;
  }[];
  return rows.map((row) => row.detail).join("\n");
}

describe("database indexes", () => {
  it.each(EXPECTED)("%s.%s leads an index", (table, column) => {
    expect(leadingIndexedColumns(table)).toContain(column);
  });

  it("finds the day's reviews by due date without scanning review_items", () => {
    const plan = queryPlan(
      "SELECT id FROM review_items WHERE due_date < 1760000000000"
    );
    expect(plan).toContain("USING INDEX");
    expect(plan).not.toMatch(FULL_SCAN_OF_REVIEW_ITEMS);
  });

  it("lists a module's activities without scanning activities", () => {
    const plan = queryPlan(
      "SELECT id FROM activities WHERE module_id = 'm' AND deleted_at IS NULL"
    );
    expect(plan).toContain("USING INDEX");
  });
});
