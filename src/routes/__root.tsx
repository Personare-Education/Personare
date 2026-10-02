import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getPendingActivityRating } from "@/actions/review";
import ActivityDifficultyDialog from "@/components/activity-difficulty-dialog";
import AppToaster from "@/components/app-toaster";
import BetaGate from "@/components/beta-gate";
import StackContent from "@/components/stack-content";
import BaseLayout from "@/layouts/base-layout";

type PendingActivityRating = Awaited<
  ReturnType<typeof getPendingActivityRating>
>;

function Root() {
  const [pending, setPending] = useState<PendingActivityRating>(null);

  useEffect(() => {
    getPendingActivityRating().then(setPending);
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
