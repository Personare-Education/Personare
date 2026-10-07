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
 * A quiz ends on its rating (docs/specs/quiz-result-rating.md): how many
 * were right, a mark per question, the ratings with one suggested by the
 * score, and rating there closes the quiz and schedules it. The radial
 * chart this file once guarded (Issue #122) now lives in QuizScoreResult,
 * kept for the future exam type.
 */

let electronApp: ElectronApplication;
let page: Page;

const CREATE_MANUALLY = /Create manually/;

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

test("finishing a quiz rates it right on its result", async () => {
  const uniqueSuffix = Date.now();
  const programName = `E2E Quiz Program ${uniqueSuffix}`;
  const moduleName = `E2E Quiz Module ${uniqueSuffix}`;
  const quizName = `E2E Quiz ${uniqueSuffix}`;

  // The app opens on Today; programs live under "Programs"
  // (docs/specs/today-review-queue.md).
  await sidebarLink(page, "Programs").click();
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
  await questionForm
    .getByRole("button", { name: "Save and add another" })
    .click();
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
  await runner.getByRole("button", { name: "Check answer" }).click();
  await runner.getByRole("button", { name: "Next question" }).click();
  await runner.getByRole("radio").last().click();
  await runner.getByRole("button", { name: "Check answer" }).click();
  await runner.getByRole("button", { name: "Finish quiz" }).click();

  // One right, one wrong: "Struggled" is the suggestion, and focus starts there.
  await expect(runner.getByText("1 of 2 correct")).toBeVisible();
  await expect(
    runner.getByText("Suggested by your score: Struggled")
  ).toBeVisible();
  const struggled = runner.getByRole("button", { name: "Struggled" });
  await expect(struggled).toBeFocused();
  await expect(
    runner.getByRole("button", { name: "Complete quiz" })
  ).toHaveCount(0);

  await struggled.click();

  // The day's first review lights the streak (docs/specs/gamification.md §1).
  await expect(page.locator("[data-igniting]")).toBeVisible();
  await expect(page.getByText("Your streak has started")).toBeVisible();
  if (process.env.EXAMS_SCREENSHOTS) {
    await page.screenshot({
      path: `${process.env.EXAMS_SCREENSHOTS}/streak-ignite.png`,
    });
  }

  // The rating's points put a fresh profile on Iron III (§3, §4).
  await page.getByRole("button", { name: "Rank: Iron III" }).click();
  const ranking = page.getByRole("dialog", { name: "Ranking" });
  await expect(ranking.getByText("Review", { exact: true })).toBeVisible();
  await expect(ranking.getByRole("img", { name: "Iron III" })).toBeVisible();
  if (process.env.EXAMS_SCREENSHOTS) {
    // Past the dialog's fade-in.
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${process.env.EXAMS_SCREENSHOTS}/ranking.png`,
    });
  }
  await ranking.getByRole("tab", { name: "All ranks" }).click();
  await expect(ranking.getByRole("listitem", { name: "Magnum" })).toBeVisible();
  if (process.env.EXAMS_SCREENSHOTS) {
    await page.screenshot({
      path: `${process.env.EXAMS_SCREENSHOTS}/ranking-all.png`,
    });
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(quizRow.getByText("Struggled")).toBeVisible();
});
