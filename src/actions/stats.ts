import { ipc } from "@/ipc/manager";

/** The last 30 days' retention and the target (docs/specs/retention-summary.md). */
export function getRetentionStats() {
  return ipc.client.review.retentionStats();
}
