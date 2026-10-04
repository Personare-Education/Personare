import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";
import { freshProfileArg } from "./fresh-profile";
import { sidebarLink } from "./sidebar-link";

/**
 * Regression test for Issue #60: `/programs/$programId/modules/$moduleId`
 * is a TanStack Router file-route child of `programs.$programId.tsx` (its
 * filename is a prefix match), so the parent must render an `<Outlet />`
 * for the child to ever mount. Before the fix, `programs.$programId.tsx`
 * rendered its own content directly with no `<Outlet />`; the router
 * internally matched the child route correctly (confirmed via its exposed
 * state during diagnosis), but nothing in the DOM ever displayed it --
 * clicking "View activities" silently did nothing.
 *
 * Unit tests could not catch this: they render `ModuleActivitiesPage` (or
 * `ModulesDataTable`) in isolation, never through the actual router's
 * match-and-render pipeline, so a broken parent/Outlet relationship is
 * invisible to them. Only a real navigation, driven through an actual
 * built app, exercises the router deeply enough to catch it -- hence this
 * e2e test instead of a unit test.
 */

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const latestBuild = findLatestBuild();
  const appInfo = parseElectronApp(latestBuild);
  process.env.CI = "e2e";

  electronApp = await electron.launch({
    args: [appInfo.main, freshProfileArg()],
  });
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  // Issue #20 made the main window's own `close` handler preventDefault()
  // unless the app is quitting via the Tray's "Sair" item (isQuitting flag)
  // -- `electronApp.close()` triggers a graceful app.quit(), which respects
  // that same prevention and now hangs until Playwright's afterAll timeout.
  // `app.exit()` bypasses the close/before-quit lifecycle entirely (it is
  // Electron's documented immediate-exit API), so it isn't blocked by the
  // app's own close interception.
  await electronApp.evaluate(({ app }) => app.exit());
});

test("navigating Programs -> Modules -> Activities renders each page", async () => {
  const uniqueSuffix = Date.now();
  const programName = `E2E Program ${uniqueSuffix}`;
  const moduleName = `E2E Module ${uniqueSuffix}`;
  const activityName = `E2E Activity ${uniqueSuffix}`;

  // The app opens on Today; programs live under "Programs"
  // (docs/specs/today-review-queue.md).
  await expect(
    page.getByRole("heading", { exact: true, name: "Today" })
  ).toBeVisible();
  await sidebarLink(page, "Programs").click();
  await expect(
    page.getByRole("heading", { exact: true, name: "Programs" })
  ).toBeVisible();
  await page.getByRole("button", { name: "New program" }).click();
  await page.getByLabel("Name").fill(programName);
  await page.getByRole("button", { name: "Save" }).click();

  // Issue #99: Programs is now a card grid, each card a single button that
  // both shows the name and navigates -- no more "View modules" row/icon.
  await page.getByRole("button", { name: new RegExp(programName) }).click();
  // The program's own name heads its screen (docs/specs/organize-identity.md).
  await expect(
    page.getByRole("heading", { exact: true, name: programName })
  ).toBeVisible();

  await page.getByRole("button", { name: "New module" }).click();
  await page.getByLabel("Name").fill(moduleName);
  await page.getByRole("button", { name: "Save" }).click();

  await page
    .getByRole("row", { name: new RegExp(moduleName) })
    .getByLabel("View activities")
    .click();

  // The regression: this heading, and everything below it, never appeared
  // before the Outlet fix -- the app silently stayed on the Modules page.
  await expect(
    page.getByRole("heading", { exact: true, name: moduleName })
  ).toBeVisible();

  await page.getByRole("button", { name: "New activity" }).click();
  await page.getByLabel("Title").fill(activityName);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText(activityName)).toBeVisible();
});
