import { ipc } from "@/ipc/manager";
import { notifyPointsChanged } from "@/utils/points-events";

/** The season's points and step (docs/specs/gamification.md §3 AC-3). */
export function getPointsSummary() {
  return ipc.client.points.summary();
}

/** What the days since the last look cost, once (§3 AC-2). */
export async function settlePoints() {
  await ipc.client.points.settle();
  notifyPointsChanged();
}

/** A finished quiz's right answers, once a day per quiz (§3). */
export async function awardQuizPoints(activityId: string, correct: number) {
  await ipc.client.points.awardQuiz({ activityId, correct });
  notifyPointsChanged();
}
