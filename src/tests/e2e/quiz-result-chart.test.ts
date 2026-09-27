import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";

/**
 * Regression test for Issue #122: the Quiz result screen showed the times but
 * no radial chart. The chart sat in a `flex-col items-center` parent
 * with no width of its own, so it shrank to its content -- Recharts'
 * ResponsiveContainer, which sizes itself from that same parent -- and ended
 * up 0x0. jsdom has no layout engine, so only a real render catches this.
 */

let electronApp: ElectronApplication;
let page: Page;

const CREATE_MANUALLY = /Create manually/;

test.beforeAll(async () => {
  const latestBuild = findLatestBuild();
  const appInfo = parseElectronApp(latestBuild);
  process.env.CI = "e2e";

  electronApp = await electron.launch({ args: [appInfo.main] });
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  // See activities-navigation.test.ts for why app.exit() instead of close().
  await electronApp.evaluate(({ app }) => app.exit());
});

test("finishing a quiz shows the stacked radial chart with a visible size", async () => {
  const uniqueSuffix = Date.now();
  const programName = `E2E Quiz Program ${uniqueSuffix}`;
  const moduleName = `E2E Quiz Module ${uniqueSuffix}`;
  const quizName = `E2E Quiz ${uniqueSuffix}`;

  await page.getByRole("button", { name: "New program" }).click();
  await page.getByLabel("Name").fill(programName);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: new RegExp(programName) }).click();

  await page.getByRole("button", { name: "New module" }).click();
  await page.getByLabel("Name").fill(moduleName);
  await page.getByRole("button", { name: "Save" }).click();
  await page
    .getByRole("row", { name: new RegExp(moduleName) })
    .getByLabel("View activities")
    .click();

  await page.getByRole("button", { name: "New activity" }).click();
  await page.getByLabel("Title").fill(quizName);
  await page.getByRole("radio", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: CREATE_MANUALLY }).click();
  await page.getByRole("button", { name: "Save" }).click();

  const quizRow = page.getByRole("row", { name: new RegExp(quizName) });
  await quizRow.getByLabel("Manage questions").click();
  const manager = page.getByRole("dialog", { name: quizName });

  // The first option is always the correct one.
  async function addQuestion(text: string, right: string, wrong: string) {
    await manager.getByRole("button", { name: "Add question" }).click();
    const questionForm = page.getByRole("dialog").last();
    await questionForm
      .getByRole("textbox", { name: "Question text" })
      .fill(text);
    const optionInputs = questionForm.getByRole("textbox", {
      name: "Option text",
    });
    await optionInputs.nth(0).fill(right);
    await optionInputs.nth(1).fill(wrong);
    await questionForm.getByRole("radio").first().check();
    await questionForm.getByRole("button", { name: "Save" }).click();

    // Saving closes the question form; the question manager stays open.
    await expect(manager.getByText(text)).toBeVisible();
  }

  await addQuestion("2 + 2?", "4", "5");
  await addQuestion("3 + 3?", "6", "7");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await quizRow.getByLabel("Take quiz").click();
  const runner = page.getByRole("dialog", { name: quizName });
  // One right, one wrong: both chart sections must show up.
  await runner.getByRole("radio").first().click();
  await runner.getByRole("button", { name: "Next question" }).click();
  await runner.getByRole("radio").last().click();
  await runner.getByRole("button", { name: "Finish quiz" }).click();

  await expect(runner.getByText("500", { exact: true })).toBeVisible();

  const chart = runner.locator('[data-slot="chart"]');
  await expect(chart).toBeVisible();
  await expect(runner.locator(".recharts-surface")).toBeVisible();
  const sections = runner.locator(".recharts-radial-bar-sectors");
  await expect(sections).toHaveCount(2);
  // Both halves drawn: a section pushed off the angle scale has no size.
  await Promise.all(
    (await sections.all()).map((section) =>
      expect
        .poll(async () => (await section.boundingBox())?.width ?? 0)
        .toBeGreaterThan(50)
    )
  );

  const box = await chart.boundingBox();
  expect(box?.width).toBeGreaterThan(100);
  expect(box?.height).toBeGreaterThan(100);
});
