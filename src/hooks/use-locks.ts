import { useCallback, useEffect, useState } from "react";
import { listLocks } from "@/actions/review";
import { onReviewCompleted } from "@/utils/review-events";
import type { Locks } from "@/utils/unlock";

const NO_LOCKS: Locks = { activities: {}, modules: {} };

/**
 * Every lock, and a way to reload it (docs/specs/sequences-and-locks.md
 * §4 AC-5); a rating anywhere in the app may unlock something, so it
 * reloads on its own then too.
 */
export function useLocks() {
  const [locks, setLocks] = useState<Locks>(NO_LOCKS);

  const refresh = useCallback(() => {
    listLocks()
      .then(setLocks)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    return onReviewCompleted(refresh);
  }, [refresh]);

  return { locks, refresh };
}
