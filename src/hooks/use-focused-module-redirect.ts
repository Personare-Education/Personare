import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

/** How long the focused module pulses on the program page before opening. */
export const FOCUSED_MODULE_REDIRECT_MS = 2500;

interface FocusedModuleRedirectOptions {
  focusDate: string | undefined;
  focusModuleId: string | undefined;
  programId: string;
}

/**
 * A calendar click lands on the program with a module in focus: it pulses
 * for a moment, then the module opens (docs/specs/calendar-module-review-highlight.md
 * AC-4). The program page is replaced in history, so going back from the
 * module returns to the calendar instead of bouncing into the module again.
 * Leaving the page before then cancels it.
 *
 * `openModule` is how the page opens a module itself: opening the focused
 * one before the pulse is over carries on the same flow (its day's
 * activities still pulse); any other module opens as usual.
 */
export function useFocusedModuleRedirect({
  focusDate,
  focusModuleId,
  programId,
}: FocusedModuleRedirectOptions) {
  const navigate = useNavigate();

  const openModule = useCallback(
    (moduleId: string) => {
      const isFocused = moduleId === focusModuleId;

      navigate({
        params: { moduleId, programId },
        replace: isFocused,
        search: isFocused ? { focusDate } : {},
        to: "/programs/$programId/modules/$moduleId",
      });
    },
    [focusDate, focusModuleId, navigate, programId]
  );

  useEffect(() => {
    if (!focusModuleId) {
      return;
    }

    const timeoutId = setTimeout(
      () => openModule(focusModuleId),
      FOCUSED_MODULE_REDIRECT_MS
    );

    return () => clearTimeout(timeoutId);
  }, [focusModuleId, openModule]);

  return { openModule };
}
