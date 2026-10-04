import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";
import { freshProfileArg } from "./fresh-profile";

/*
 * Using Playwright with Electron:
 * https://www.electronjs.org/pt/docs/latest/tutorial/automated-testing#using-playwright
 */

let electronApp: ElectronApplication;

test.beforeAll(async () => {
  const latestBuild = findLatestBuild();
  const appInfo = parseElectronApp(latestBuild);
  process.env.CI = "e2e";

  electronApp = await electron.launch({
    args: [appInfo.main, freshProfileArg()],
  });
  electronApp.on("window", (page) => {
    const filename = page.url()?.split("/").pop();
    console.log(`Window opened: ${filename}`);

    page.on("pageerror", (error) => {
      console.error(error);
    });
    page.on("console", (msg) => {
      console.log(msg.text());
    });
  });
});

test.afterAll(async () => {
  // See src/tests/e2e/activities-navigation.test.ts's afterAll for why
  // app.exit() is used instead of electronApp.close() -- Issue #20's
  // close-to-tray behavior blocks the graceful quit path close() relies on.
  // This file previously had no explicit teardown at all, relying on
  // Playwright's own worker-level cleanup; that cleanup hit the same hang.
  await electronApp.evaluate(({ app }) => app.exit());
});

test("renders the first page", async () => {
  const page: Page = await electronApp.firstWindow();

  // The document title (from index.html) is a stable smoke-test signal --
  // unlike the home route's content, it doesn't change as the home page
  // evolves from placeholder to real features (e.g. Issue #8's Programs
  // Data Table). Electron shows a transient "Loading file://..." window
  // title until the renderer finishes its first paint, so poll for the
  // real title instead of trusting domcontentloaded's timing.
  await expect.poll(() => page.title()).toBe("Personare");
});
