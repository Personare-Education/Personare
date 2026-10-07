import { os } from "@orpc/server";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  pointsSummary,
  recordQuizPoints,
  settlePoints,
} from "@/ipc/shared/points";
import { awardQuizInputSchema } from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

/** The season's points and step (docs/specs/gamification.md §3 AC-3). */
export const summary = os.handler(() =>
  pointsSummary(requireDatabaseClient(), new Date())
);

/** What the days since the last look cost, once (§3 AC-2). */
export const settle = os.handler(() => {
  settlePoints(requireDatabaseClient(), new Date());
});

/** A finished quiz's right answers, once a day per quiz (§3). */
export const awardQuiz = os.input(awardQuizInputSchema).handler(({ input }) => {
  recordQuizPoints(requireDatabaseClient(), { ...input, now: new Date() });
});
