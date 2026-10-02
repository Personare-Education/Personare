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

  // Creating a manual quiz opens its question manager with the form for the
  // first question already up (docs/specs/flashcard-editor-and-creation-flow.md).
  const manager = page.getByRole("dialog", { name: quizName });
  const questionForm = page.getByRole("dialog").last();
  const editor = questionForm.getByRole("textbox", {
    name: "Question text or alternative",
  });

  // One editor: the first submission is the question, the next ones its
  // alternatives (docs/specs/quiz-question-single-editor.md).
  async function send(text: string) {
    await editor.fill(text);
    await editor.press("Shift+Enter");
  }

  // The first alternative is always the correct one.
  async function writeQuestion(text: string, right: string, wrong: string) {
    await send(text);
    await send(right);
    await send(wrong);
    await questionForm
      .getByRole("button", { name: "Mark as correct" })
      .first()
      .click();
  }

  await writeQuestion("2 + 2?", "4", "5");
  await questionForm.getByRole("button", { name: "Add question" }).click();
  // Saved and reset for the next question.
  await expect(
    questionForm.getByRole("region", { name: "Question text" })
  ).toHaveCount(0);
  await writeQuestion("3 + 3?", "6", "7");
  await questionForm.getByRole("button", { name: "Done" }).click();

  await expect(manager.getByText("2 + 2?")).toBeVisible();
  await expect(manager.getByText("3 + 3?")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const quizRow = page.getByRole("row", { name: new RegExp(quizName) });
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
