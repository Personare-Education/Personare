import { useCallback, useEffect, useRef } from "react";
import {
  armPendingActivityRating,
  clearPendingActivityRating,
} from "@/actions/review";
import { openActivityFile } from "@/actions/shell";
import type { Activity } from "@/components/activities-data-table";

/**
 * Opens the difficulty rating on the next window focus after a PDF/Link is
 * opened externally (Issue #103) -- the app never navigates away when the OS
 * opens an external viewer/browser, so the caller's route is still mounted
 * when the user comes back.
 */
export function useRateOnReturn(onReturn: (activity: Activity) => void) {
  const armedActivityRef = useRef<Activity | null>(null);
  const onReturnRef = useRef(onReturn);
  onReturnRef.current = onReturn;

  useEffect(() => {
    function handleWindowFocus() {
      const armed = armedActivityRef.current;
      if (armed) {
        armedActivityRef.current = null;
        onReturnRef.current(armed);
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  const arm = useCallback((activity: Activity) => {
    armPendingActivityRating(activity.id);
    armedActivityRef.current = activity;
  }, []);

  const openPdf = useCallback(
    async (activity: Activity) => {
      if (!activity.filePath) {
        return;
      }

      // Armed before opening, not after: on Linux shell.openPath waits for
      // xdg-open, which on many desktops only exits when the viewer closes
      // (Issue #121) -- the user would already be back by then.
      arm(activity);
      const { errorMessage } = await openActivityFile(activity.filePath);

      if (errorMessage) {
        if (armedActivityRef.current?.id === activity.id) {
          armedActivityRef.current = null;
        }
        clearPendingActivityRating(activity.id);
      }
    },
    [arm]
  );

  return { arm, openPdf };
}
