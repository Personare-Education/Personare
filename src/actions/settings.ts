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
