import { randomUUID } from "node:crypto";
import {
  type AnySQLiteColumn,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const healthCheck = sqliteTable("health_check", {
  id: integer("id").primaryKey({ autoIncrement: true }),
});

export const programs = sqliteTable("programs", {
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  icon: text("icon"),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const modules = sqliteTable("modules", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  /** Its place in the program's list (docs/specs/sequences-and-locks.md). */
  position: integer("position").notNull().default(0),
  programId: text("program_id")
    .notNull()
    .references(() => programs.id),
  /** none | previous | any | all; the lists live in unlock_requirements. */
  unlockMode: text("unlock_mode").notNull().default("none"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * `type` is an open, application-validated discriminator (link, quiz, pdf,
 * flashcard_deck, ...), not a closed SQLite enum/CHECK constraint -- new
 * Activity types must not require a destructive migration (Plan.md 1.1).
 */
export const activities = sqliteTable("activities", {
  /**
   * The first time it was done: its first rating, or -- for a sub-activity
   * -- doing it inside its group. What unlock rules check
   * (docs/specs/sequences-and-locks.md).
   */
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  filePath: text("file_path"),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id),
  /** The group (type "group") a sub-activity belongs to, if any. */
  parentActivityId: text("parent_activity_id").references(
    (): AnySQLiteColumn => activities.id
  ),
  /** Its place in its module's list, or in its group's. */
  position: integer("position").notNull().default(0),
  title: text("title").notNull(),
  type: text("type").notNull(),
  /** none | previous | any | all; the lists live in unlock_requirements. */
  unlockMode: text("unlock_mode").notNull().default("none"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  url: text("url"),
});

/**
 * The list behind an "any" or "all" unlock rule: what `subjectId` (an
 * activity or a module, per `subjectKind`) requires done first. Rows that
 * point at something deleted are ignored when the rule is checked
 * (docs/specs/sequences-and-locks.md).
 */
export const unlockRequirements = sqliteTable("unlock_requirements", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  requiredId: text("required_id").notNull(),
  subjectId: text("subject_id").notNull(),
  subjectKind: text("subject_kind").notNull(),
});

/**
 * quiz_options intentionally mirrors quiz_questions' soft-delete strategy
 * (a nullable deleted_at column) rather than hard delete-and-recreate, so
 * softDeleteOption behaves exactly like every other soft-delete in the app.
 */
export const quizQuestions = sqliteTable("quiz_questions", {
  /** The quiz it belongs to, or null for an exam's standalone question. */
  activityId: text("activity_id").references(() => activities.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  /**
   * The exam it belongs to, for a standalone question; exactly one of
   * activityId/examId is set (docs/specs/exams.md).
   */
  examId: text("exam_id").references(() => exams.id),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  /** File name of an optional attached image, under userData/attachments/. */
  imagePath: text("image_path"),
  text: text("text").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const quizOptions = sqliteTable("quiz_options", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  /** File name of an optional attached image, under userData/attachments/. */
  imagePath: text("image_path"),
  isCorrect: integer("is_correct", { mode: "boolean" })
    .notNull()
    .default(false),
  questionId: text("question_id")
    .notNull()
    .references(() => quizQuestions.id),
  text: text("text").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const flashcards = sqliteTable("flashcards", {
  activityId: text("activity_id")
    .notNull()
    .references(() => activities.id),
  back: text("back").notNull(),
  /** File name of an optional attached image, under userData/attachments/. */
  backImagePath: text("back_image_path"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  front: text("front").notNull(),
  /** File name of an optional attached image, under userData/attachments/. */
  frontImagePath: text("front_image_path"),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * An exam (docs/specs/exams.md): drawn at random from its modules' quizzes,
 * plus its standalone questions, taken on demand -- no FSRS.
 */
export const exams = sqliteTable("exams", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  /** The share of right answers that passes, in percent. */
  passingScore: integer("passing_score").notNull().default(70),
  programId: text("program_id")
    .notNull()
    .references(() => programs.id),
  /** How many questions an attempt draws from the modules. */
  questionCount: integer("question_count").notNull(),
  /** Null when the exam has no time limit. */
  timeLimitMinutes: integer("time_limit_minutes"),
  title: text("title").notNull(),
  /**
   * none | sources | all | any | exam; the lists live in unlock_requirements
   * (docs/specs/exam-locks.md).
   */
  unlockMode: text("unlock_mode").notNull().default("none"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/** The modules an exam draws its questions from. */
export const examModules = sqliteTable("exam_modules", {
  examId: text("exam_id")
    .notNull()
    .references(() => exams.id),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id),
});

/** A finished attempt; one abandoned midway is never saved. */
export const examAttempts = sqliteTable("exam_attempts", {
  correct: integer("correct").notNull(),
  durationMs: integer("duration_ms").notNull(),
  examId: text("exam_id")
    .notNull()
    .references(() => exams.id),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  total: integer("total").notNull(),
});

/**
 * ReviewItem is the first-class entity scheduled by FSRS, decoupled from the
 * content hierarchy: it references only the Flashcard or Activity that
 * schedules it, not the Module/Program above it. It preserves its review
 * history even after the underlying content is edited.
 *
 * Exactly one of flashcardId/activityId is set (app-validated, same open
 * discriminator style as activities.type -- not a DB CHECK constraint):
 * flashcardId for an individual Flashcard inside a flashcard_deck Activity,
 * activityId for a quiz/pdf/link Activity reviewed as a whole (Issue #77).
 */
export const reviewItems = sqliteTable("review_items", {
  activityId: text("activity_id").references(() => activities.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  difficulty: real("difficulty").notNull(),
  dueDate: integer("due_date", { mode: "timestamp_ms" }).notNull(),
  flashcardId: text("flashcard_id").references(() => flashcards.id),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  lapses: integer("lapses").notNull().default(0),
  lastRating: text("last_rating").notNull(),
  lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  learningSteps: integer("learning_steps").notNull().default(0),
  ratingHistory: text("rating_history").notNull(),
  reps: integer("reps").notNull().default(0),
  scheduledDays: integer("scheduled_days").notNull().default(0),
  stability: real("stability").notNull(),
  state: text("state").notNull().default("New"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Singleton settings row -- id is always 1, never a UUID like the rest of
 * the schema. The row is created lazily on first read/write (AC-4), not
 * seeded by a migration.
 */
export const appSettings = sqliteTable("app_settings", {
  autoStartEnabled: integer("auto_start_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  id: integer("id").primaryKey(),
  /** Settings → Sounds (docs/specs/gamification.md §2 AC-3). */
  soundsEnabled: integer("sounds_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  /**
   * Update from pre-releases too (docs/specs/prerelease-updates.md): on by
   * default while Personare is in beta.
   */
  testPrereleases: integer("test_prereleases", { mode: "boolean" })
    .notNull()
    .default(true),
});

/**
 * One row per Activity opened/finished but not yet rated (Issue #103):
 * markActivityDifficulty (Issue #77) creates its review_items row already
 * rated, get-or-create-and-rate atomically -- there is no "ensured but
 * unrated" review_items row to key off of for "the app was closed before
 * the user picked a rating, prompt again on next launch". This table is
 * that separate, durable marker; a row is deleted as soon as the Activity
 * is actually rated (see clearPendingActivityRating).
 */
export const pendingActivityRatings = sqliteTable("pending_activity_ratings", {
  activityId: text("activity_id")
    .primaryKey()
    .references(() => activities.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
