import os from "node:os";
import path from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";

/**
 * Spec: docs/specs/pdf-activity-dropzone.md -- creating a PDF activity is
 * two steps, the file picked in a drop-zone. The native file dialog is
 * stubbed in the main process; a real drag from the OS can't be simulated
 * (a synthetic File has no path on disk), so the drop's preload bridge is
 * checked to be wired instead.
 */

let electronApp: ElectronApplication;
let page: Page;

const PDF_PATH = path.join(os.tmpdir(), "apostila-e2e.pdf");

test.beforeAll(async () => {
  const appInfo = parseElectronApp(findLatestBuild());
  process.env.CI = "e2e";
  electronApp = await electron.launch({ args: [appInfo.main] });
  page = await electronApp.firstWindow();

  await electronApp.evaluate(({ dialog }, pdfPath) => {
    dialog.showOpenDialog = (() =>
      Promise.resolve({
        canceled: false,
        filePaths: [pdfPath],
      })) as typeof dialog.showOpenDialog;
  }, PDF_PATH);
});

test.afterAll(async () => {
  // See activities-navigation.test.ts for why app.exit() instead of close().
  await electronApp.evaluate(({ app }) => app.exit());
});

test("creates a PDF activity through the file step's drop-zone", async () => {
  const uniqueSuffix = Date.now();
  const programName = `E2E Pdf Program ${uniqueSuffix}`;
  const moduleName = `E2E Pdf Module ${uniqueSuffix}`;
  const pdfTitle = `E2E Pdf ${uniqueSuffix}`;

  await page.getByRole("button", { name: "New program" }).click();
  await page.getByLabel("Name").fill(programName);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: new RegExp(programName) }).click();
  await page.getByRole("button", { name: "New module" }).click();
  await page.getByLabel("Name").fill(moduleName);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("row", { name: new RegExp(moduleName) }).click();

  await page.getByRole("button", { name: "New activity" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(pdfTitle);
  await dialog.getByRole("radio", { name: "PDF" }).click();
  await expect(dialog.getByText("Step 1 of 2")).toBeVisible();
  await dialog.getByRole("button", { name: "Next" }).click();

  await expect(dialog.getByText("Step 2 of 2")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(
    await page.evaluate(() => typeof window.personare?.getPathForFile)
  ).toBe("function");

  await dialog.getByText("Drag the PDF here or click to choose").click();
  await expect(dialog.getByText("apostila-e2e.pdf")).toBeVisible();
  await page.screenshot({
    path: path.join(os.tmpdir(), "pdf-activity-dropzone.png"),
  });
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("row", { name: new RegExp(pdfTitle) })
  ).toBeVisible();
});
