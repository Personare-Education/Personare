import { ipc } from "@/ipc/manager";

export function getSettings() {
  return ipc.client.settings.get();
}

export function setAutoStart(enabled: boolean) {
  return ipc.client.settings.setAutoStart({ enabled });
}

/** Update from pre-releases too (docs/specs/prerelease-updates.md). */
export function setTestPrereleases(enabled: boolean) {
  return ipc.client.settings.setTestPrereleases({ enabled });
}

/** Settings → Sounds (docs/specs/gamification.md §2 AC-3). */
export function setSoundsEnabled(enabled: boolean) {
  return ipc.client.settings.setSoundsEnabled({ enabled });
}

/** The retention FSRS schedules for (docs/specs/desired-retention.md). */
export function setDesiredRetention(desiredRetention: number) {
  return ipc.client.settings.setDesiredRetention({ desiredRetention });
}
