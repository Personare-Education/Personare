import { BACKEND_BASE_URL } from "@/constants";

/**
 * Where the app looks for updates: the backend's feed, shaped like
 * update.electronjs.org, on the channel the "Test pre-releases" setting
 * picks (docs/specs/prerelease-updates.md AC-3). update.electronjs.org
 * itself only serves GitHub's latest regular release, and every beta
 * version is a pre-release.
 */
export function updateFeedHost(testPrereleases: boolean): string {
  return `${BACKEND_BASE_URL}/updates/${testPrereleases ? "prerelease" : "stable"}`;
}
