import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { settlePoints } from "@/actions/points";
import { getPendingActivityRating } from "@/actions/review";
import { getSettings } from "@/actions/settings";
import ActivityDifficultyDialog from "@/components/activity-difficulty-dialog";
import AppToaster from "@/components/app-toaster";
import BetaGate from "@/components/beta-gate";
import StackContent from "@/components/stack-content";
import BaseLayout from "@/layouts/base-layout";
import { setSoundsEnabled } from "@/utils/sounds";

type PendingActivityRating = Awaited<
  ReturnType<typeof getPendingActivityRating>
>;

function Root() {
  const [pending, setPending] = useState<PendingActivityRating>(null);

  useEffect(() => {
    getPendingActivityRating().then(setPending);
    // Settings → Sounds, before the first sound (docs/specs/gamification.md §2).
    getSettings()
      .then((settings) => setSoundsEnabled(settings.soundsEnabled))
      .catch(() => undefined);
  }, []);

  // What the days away cost, once on launch and again as each day turns
  // (docs/specs/gamification.md §3 AC-2).
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const settleAndWait = () => {
      settlePoints().catch(() => undefined);
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5
      );
      timeout = setTimeout(settleAndWait, midnight.getTime() - now.getTime());
    };
    settleAndWait();
    return () => clearTimeout(timeout);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setPending(null);
    }
  }, []);

  const handleRated = useCallback(() => {
    setPending(null);
  }, []);

  return (
    <BetaGate>
      <BaseLayout>
        <StackContent>
          <Outlet />
        </StackContent>
        <ActivityDifficultyDialog
          activityId={pending?.activityId ?? null}
          activityTitle={pending?.activityTitle ?? ""}
          moduleName={pending?.moduleName ?? ""}
          onOpenChange={handleOpenChange}
          onRated={handleRated}
          open={pending !== null}
          programName={pending?.programName ?? ""}
        />
      </BaseLayout>
      {/* Outside the layout: its stack-content view transition makes a
          stacking context that would trap notices under a dialog's overlay. */}
      <AppToaster />
    </BetaGate>
  );
}

export const Route = createRootRoute({
  component: Root,
});
