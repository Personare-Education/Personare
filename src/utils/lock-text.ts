import type { TFunction } from "i18next";
import type { LockState } from "@/utils/unlock";

/**
 * What a padlock says (docs/specs/sequences-and-locks.md §4 AC-2): what is
 * still missing, joined with "and" -- or "or", for an any-of rule -- or,
 * while it waits for its module or sequence, which one.
 */
export function describeLock(
  t: TFunction,
  language: string,
  lock: LockState,
  mode: string,
  names: Record<string, string | undefined>,
  /** Each exam's passing score, for a module waiting for one. */
  examScores: Record<string, number | undefined> = {}
): string {
  // Locked with its module or sequence: name that one.
  if (lock.waiting) {
    return t("lockWaitingLabel", { item: names[lock.missing[0].id] ?? "" });
  }
  // Waiting for an exam: which one, and the score that passes
  // (docs/specs/exams.md §4 AC-3).
  const [first] = lock.missing;
  if (first?.kind === "exam") {
    return t("lockExamLabel", {
      exam: names[first.id] ?? "",
      score: examScores[first.id] ?? 0,
    });
  }
  const items = new Intl.ListFormat(language, {
    style: "long",
    type: mode === "any" ? "disjunction" : "conjunction",
  }).format(lock.missing.map((item) => names[item.id] ?? ""));
  return t("lockMissingLabel", { items });
}
