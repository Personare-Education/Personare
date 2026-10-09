/**
 * How much the student actually remembered (docs/specs/retention-summary.md):
 * of the reviews in the last 30 days, the share not rated "again". Read off
 * each review item's ratingHistory, the only per-rating record there is.
 */

export const RETENTION_WINDOW_DAYS = 30;

/**
 * A rating this soon after the one before is the same sitting (a flashcard
 * relearned in its session), not a test of memory.
 */
const SAME_SITTING_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface HistoryEntry {
  rating: string;
  reviewedAt: number;
}

function parseHistory(json: string): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export interface RetentionCount {
  /** Reviews that tested memory: not an item's first, not the same sitting. */
  attempts: number;
  /** Of those, the ones not rated "again". */
  remembered: number;
}

export function computeRetention(
  histories: string[],
  now: Date
): RetentionCount {
  const since = now.getTime() - RETENTION_WINDOW_DAYS * DAY_MS;
  let attempts = 0;
  let remembered = 0;

  for (const json of histories) {
    const entries = parseHistory(json).toSorted(
      (a, b) => a.reviewedAt - b.reviewedAt
    );
    for (let index = 1; index < entries.length; index += 1) {
      const entry = entries[index];
      const isLaterSitting =
        entry.reviewedAt - entries[index - 1].reviewedAt >= SAME_SITTING_MS;
      if (entry.reviewedAt >= since && isLaterSitting) {
        attempts += 1;
        if (entry.rating !== "again") {
          remembered += 1;
        }
      }
    }
  }

  return { attempts, remembered };
}
