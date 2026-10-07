import type { DatabaseClient } from "@/database/client";
import {
  activities,
  appSettings,
  examAttempts,
  examModules,
  exams,
  flashcards,
  modules,
  programs,
  quizOptions,
  quizQuestions,
  reviewItems,
  unlockRequirements,
} from "@/database/schema";
import { backfillSequenceData } from "@/database/sequence-backfill";
import type { BackupData } from "@/utils/backup-codec";

export function collectBackupData(
  db: DatabaseClient
): Omit<BackupData, "exportedAt" | "version"> {
  return {
    activities: db.select().from(activities).all(),
    appSettings: db.select().from(appSettings).all(),
    examAttempts: db.select().from(examAttempts).all(),
    examModules: db.select().from(examModules).all(),
    exams: db.select().from(exams).all(),
    flashcards: db.select().from(flashcards).all(),
    modules: db.select().from(modules).all(),
    programs: db.select().from(programs).all(),
    quizOptions: db.select().from(quizOptions).all(),
    quizQuestions: db.select().from(quizQuestions).all(),
    reviewItems: db.select().from(reviewItems).all(),
    unlockRequirements: db.select().from(unlockRequirements).all(),
  };
}

type Transaction = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

/**
 * The tables older backups lack (unlock rules, exams): restored when there,
 * left empty when not.
 */
function restoreLaterTables(
  tx: Transaction,
  data: Omit<BackupData, "exportedAt" | "version">
): void {
  if (data.exams && data.exams.length > 0) {
    tx.insert(exams).values(data.exams).run();
  }
  if (data.examModules && data.examModules.length > 0) {
    tx.insert(examModules).values(data.examModules).run();
  }
  if (data.examAttempts && data.examAttempts.length > 0) {
    tx.insert(examAttempts).values(data.examAttempts).run();
  }
  if (data.unlockRequirements && data.unlockRequirements.length > 0) {
    tx.insert(unlockRequirements).values(data.unlockRequirements).run();
  }
}

export function restoreBackupData(
  db: DatabaseClient,
  data: Omit<BackupData, "exportedAt" | "version">
): void {
  db.transaction((tx) => {
    tx.delete(unlockRequirements).run();
    tx.delete(reviewItems).run();
    tx.delete(quizOptions).run();
    tx.delete(quizQuestions).run();
    tx.delete(examAttempts).run();
    tx.delete(examModules).run();
    tx.delete(exams).run();
    tx.delete(flashcards).run();
    tx.delete(activities).run();
    tx.delete(modules).run();
    tx.delete(programs).run();
    tx.delete(appSettings).run();

    if (data.programs.length > 0) {
      tx.insert(programs).values(data.programs).run();
    }
    if (data.modules.length > 0) {
      tx.insert(modules).values(data.modules).run();
    }
    if (data.activities.length > 0) {
      tx.insert(activities).values(data.activities).run();
    }
    // Before the questions: a standalone question points at its exam.
    restoreLaterTables(tx, data);
    if (data.flashcards.length > 0) {
      tx.insert(flashcards).values(data.flashcards).run();
    }
    if (data.quizQuestions.length > 0) {
      tx.insert(quizQuestions).values(data.quizQuestions).run();
    }
    if (data.quizOptions.length > 0) {
      tx.insert(quizOptions).values(data.quizOptions).run();
    }
    if (data.reviewItems.length > 0) {
      tx.insert(reviewItems).values(data.reviewItems).run();
    }
    if (data.appSettings.length > 0) {
      tx.insert(appSettings).values(data.appSettings).run();
    }
  });
  // A backup from before sequences and locks lacks their order and
  // completion; fill them as the migration did
  // (docs/specs/sequences-and-locks.md §1 AC-8).
  if (!data.unlockRequirements) {
    backfillSequenceData(db);
  }
}
