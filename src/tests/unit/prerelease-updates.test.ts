import { describe, expect, it } from "vitest";
import { BACKEND_BASE_URL } from "@/constants";
import { updateFeedHost } from "@/main/update-feed";

/**
 * RED phase (docs/specs/prerelease-updates.md AC-3): the app asks the
 * backend's feed, on the channel its setting picks.
 */

describe("updateFeedHost", () => {
  it("asks for pre-releases while testing them", () => {
    expect(updateFeedHost(true)).toBe(`${BACKEND_BASE_URL}/updates/prerelease`);
  });

  it("asks for regular versions only otherwise", () => {
    expect(updateFeedHost(false)).toBe(`${BACKEND_BASE_URL}/updates/stable`);
  });
});
