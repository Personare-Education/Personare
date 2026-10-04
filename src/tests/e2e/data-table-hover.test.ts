import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";
import { freshProfileArg } from "./fresh-profile";

/**
 * Data tables: the header row must not change color on hover, and a body
 * row's hover background must stay inside the table's rounded border. Hover
 * styles only exist in a real renderer, so this runs against the built app.
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
  // See activities-navigation.test.ts for why app.exit() instead of close().
  await electronApp.evaluate(({ app }) => app.exit());
});

function backgroundOf(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );
}

test("data table header ignores hover and rows stay inside the rounded border", async () => {
  const uniqueSuffix = Date.now();
  const programName = `E2E Table Program ${uniqueSuffix}`;
  const moduleName = `E2E Table Module ${uniqueSuffix}`;

  // The app opens on Today; programs live under "Programs"
  // (docs/specs/today-review-queue.md).
  await page.getByRole("link", { exact: true, name: "Programs" }).click();
  await page.getByRole("button", { name: "New program" }).click();
  await page.getByLabel("Name").fill(programName);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: new RegExp(programName) }).click();

  await page.getByRole("button", { name: "New module" }).click();
  await page.getByLabel("Name").fill(moduleName);
  await page.getByRole("button", { name: "Save" }).click();

  const table = page.getByRole("table");
  const headerRow = table.locator("thead tr");
  const lastRow = table.locator("tbody tr").last();
  await expect(lastRow).toContainText(moduleName);

  const headerBefore = await backgroundOf(headerRow);
  await headerRow.hover();
  // Rows fade with `transition-colors`; compare once it would have finished.
  await page.waitForTimeout(500);
  expect(await backgroundOf(headerRow)).toBe(headerBefore);

  // The rounded border lives on the table's wrapper; without clipping, the
  // hovered last row paints its square corners over the rounded ones.
  const wrapper = page.locator('[data-slot="table-container"]').locator("..");
  await expect(wrapper).toHaveCSS("overflow", "hidden");
});
