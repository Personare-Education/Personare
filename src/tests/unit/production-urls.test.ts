import { afterEach, describe, expect, test, vi } from "vitest";

/*
 * docs/specs/production-urls.md: the packaged app talks to the deployed
 * backend and website, while `npm start` keeps using the local ones.
 */

async function constantsFor(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return await import("@/constants");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("backend and website URLs", () => {
  test("the packaged app uses the deployed backend and website", async () => {
    const constants = await constantsFor("production");

    expect(constants.BACKEND_BASE_URL).toBe("https://personare-backend.fly.dev");
    expect(constants.PERSONARE_SITE_URL).toBe(
      "https://personare-website.wandering-pond-32a8.workers.dev"
    );
  });

  test("development keeps the local backend and website", async () => {
    const constants = await constantsFor("development");

    expect(constants.BACKEND_BASE_URL).toBe("http://localhost:3333");
    expect(constants.PERSONARE_SITE_URL).toBe("http://localhost:5173");
  });
});
