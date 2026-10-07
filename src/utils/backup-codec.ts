import type {
  activities,
  appSettings,
  examAttempts,
  examModules,
  exams,
  flashcards,
  modules,
  pointEvents,
  programs,
  quizOptions,
  quizQuestions,
  reviewItems,
  unlockRequirements,
} from "@/database/schema";

export interface BackupData {
  activities: (typeof activities.$inferSelect)[];
  appSettings: (typeof appSettings.$inferSelect)[];
  /** Missing in backups made before exams (docs/specs/exams.md §1 AC-10). */
  examAttempts?: (typeof examAttempts.$inferSelect)[];
  examModules?: (typeof examModules.$inferSelect)[];
  exams?: (typeof exams.$inferSelect)[];
  exportedAt: Date;
  flashcards: (typeof flashcards.$inferSelect)[];
  modules: (typeof modules.$inferSelect)[];
  /** Missing in backups made before points (docs/specs/gamification.md §3 AC-4). */
  pointEvents?: (typeof pointEvents.$inferSelect)[];
  programs: (typeof programs.$inferSelect)[];
  quizOptions: (typeof quizOptions.$inferSelect)[];
  quizQuestions: (typeof quizQuestions.$inferSelect)[];
  reviewItems: (typeof reviewItems.$inferSelect)[];
  /** Missing in backups made before sequences and locks: all free then. */
  unlockRequirements?: (typeof unlockRequirements.$inferSelect)[];
  version: 1;
}

const DATE_MARKER = "Date";

/**
 * Walks the object tree replacing Date instances with a plain marker object
 * before JSON.stringify runs. A stringify replacer function cannot do this
 * directly: JSON.stringify calls Date.prototype.toJSON() (which returns an
 * ISO string) before invoking the replacer, so by the time the replacer sees
 * the value it is already a string, not a Date.
 */
function markDates(value: unknown): unknown {
  if (value instanceof Date) {
    return { __type: DATE_MARKER, value: value.getTime() };
  }
  if (Array.isArray(value)) {
    return value.map(markDates);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, markDates(nested)])
    );
  }
  return value;
}

export function serializeBackup(data: BackupData): string {
  return JSON.stringify(markDates(data));
}

export function deserializeBackup(json: string): BackupData {
  return JSON.parse(json, (_key, value) =>
    value &&
    typeof value === "object" &&
    (value as { __type?: string }).__type === DATE_MARKER
      ? new Date((value as { value: number }).value)
      : value
  ) as BackupData;
}
