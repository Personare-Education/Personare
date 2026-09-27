import { useCallback, useEffect, useState } from "react";
import {
  ensureReviewItems,
  listSchedule,
  type ScheduleRow,
} from "@/actions/calendar";

/**
 * Every review_item with its program, module and activity -- the same rows
 * the calendar shows -- for pulsing pending reviews
 * (docs/specs/calendar-module-review-highlight.md). `refresh` reloads them
 * after a review is done, so its pulse goes away.
 */
export function useReviewSchedule() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  const refresh = useCallback(() => {
    ensureReviewItems()
      .then(() => listSchedule())
      .then(setRows);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { refresh, rows };
}
