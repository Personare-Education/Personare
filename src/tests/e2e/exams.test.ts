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
 * Exams end to end (docs/specs/exams.md): one drawn from a module's quiz,
 * a second module that waits for it, and taking it -- with no right or
 * wrong until submitted -- to the score that unlocks that module.
 */

let electronApp: ElectronApplication;
let page: Page;

const CREATE_MANUALLY = /Create manually/;
// Which question comes first is drawn at random; "4" and "6" are right.
const RIGHT_ANSWER = /^(4|6)$/;
const SCREENSHOTS = process.env.EXAMS_SCREENSHOTS;

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

/** A look at the screen, when asked for (EXAMS_SCREENSHOTS=<folder>). */
async function shot(name: string) {
  if (SCREENSHOTS) {
    await page.screenshot({ path: `${SCREENSHOTS}/${name}.png` });
  }
}

test("an exam drawn from a quiz unlocks the module that waits for it", async () => {
  const suffix = Date.now();
  const programName = `E2E Exam Program ${suffix}`;
  const basics = `Basics ${suffix}`;
  const advanced = `Advanced ${suffix}`;
  const quizName = `Basics quiz ${suffix}`;
  const examName = `Basics exam ${suffix}`;

  await sidebarLink(page, "Programs").click();
  await page.getByRole("button", { name: "New program" }).click();
  await page.getByLabel("Name").fill(programName);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: new RegExp(programName) }).click();

  async function createModule(name: string) {
    await page.getByRole("button", { name: "New module" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save" }).click();
  }
  await createModule(basics);
  await createModule(advanced);

  // A quiz with two questions in Basics; the first alternative is right.
  await page
    .getByRole("row", { name: new RegExp(basics) })
    .getByLabel("View activities")
    .click();
  await page.getByRole("button", { name: "New activity" }).click();
  await page.getByLabel("Title").fill(quizName);
  await page.getByRole("radio", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("radio", { name: CREATE_MANUALLY }).click();
  await page.getByRole("button", { name: "Save" }).click();
  const questionForm = page.getByRole("dialog").last();
  const editor = questionForm.getByRole("textbox", {
    name: "Question text or alternative",
  });
  async function send(text: string) {
    await editor.fill(text);
    await editor.press("Shift+Enter");
  }
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
  await expect(
    questionForm.getByRole("region", { name: "Question text" })
  ).toHaveCount(0);
  await writeQuestion("3 + 3?", "6", "7");
  await questionForm.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("dialog", { name: quizName }).getByText("3 + 3?")
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: programName }).click();

  // The Exams section sits below the modules (§2 AC-1).
  const exams = page.getByRole("region", { name: "Exams" });
  await expect(exams.getByText("An exam draws random questions")).toBeVisible();
  await exams.getByRole("button", { name: "New exam" }).click();
  const form = page.getByRole("dialog", { name: "New exam" });
  await form.getByLabel("Title").fill(examName);
  // Advanced has no quiz: it cannot be drawn from (§2 AC-3).
  await expect(
    form.getByRole("checkbox", { name: new RegExp(advanced) })
  ).toBeDisabled();
  await form.getByRole("checkbox", { name: new RegExp(basics) }).check();
  await form.getByLabel("How many questions to draw").fill("2");
  await form.getByRole("button", { name: "Decrease" }).first().click();
  await expect(form.getByLabel("How many questions to draw")).toHaveValue("1");
  await form.getByRole("button", { name: "Increase" }).first().click();
  await shot("1-exam-form");

  // Standalone questions sit apart from Save; on a new exam they save it
  // first, and the form goes on editing it (§2 AC-4).
  await form.getByRole("button", { name: "Standalone questions" }).click();
  await expect(page.getByRole("dialog", { name: examName })).toBeVisible();
  await page.keyboard.press("Escape");
  const editForm = page.getByRole("dialog", { name: "Edit exam" });
  await expect(editForm).toBeVisible();
  // Save only saves.
  await editForm.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const examRow = exams.getByRole("row", { name: new RegExp(examName) });
  await expect(examRow.getByText("Not taken yet")).toBeVisible();

  // Advanced waits for the exam (§4 AC-1).
  const advancedRow = page.getByRole("row", { name: new RegExp(advanced) });
  await advancedRow.getByLabel("More actions").click();
  await page.getByRole("menuitem", { name: "Unlock rule" }).click();
  const rule = page.getByRole("dialog");
  await rule.getByRole("radio", { name: "After passing an exam" }).click();
  await rule.getByRole("radio", { name: examName }).click();
  await shot("2-unlock-rule");
  await rule.getByRole("button", { name: "Save" }).click();
  await expect(
    advancedRow.getByText(`Unlocks after passing ${examName} (70%)`)
  ).toBeVisible();
  await shot("3-program-page");

  // Taking it: no right or wrong on the way (§3 AC-2).
  await examRow.getByRole("button", { name: "Take exam" }).click();
  const runner = page.getByRole("dialog", { name: examName });
  await expect(runner.getByText("Question 1 of 2")).toBeVisible();
  await runner.getByRole("radio", { name: RIGHT_ANSWER }).click();
  await expect(runner.getByText("Correct")).toHaveCount(0);
  await shot("4-runner");
  await runner.getByRole("button", { name: "Next question" }).click();
  await runner.getByRole("radio", { name: RIGHT_ANSWER }).click();
  await expect(runner.getByText("Correct")).toHaveCount(0);
  await runner.getByRole("button", { name: "Submit exam" }).click();

  await expect(runner.getByText("Passed · 70% to pass")).toBeVisible();
  await expect(runner.getByText("2 of 2 correct")).toBeVisible();
  // After the score counts up, the time cards come in.
  await expect(runner.getByText("Total time")).toBeVisible();
  await expect(runner.getByText("1000", { exact: true })).toBeVisible();
  await shot("5-result");
  await page.keyboard.press("Escape");

  // Passed: the score shows and Advanced is free (§4 AC-4).
  await expect(examRow.getByText("1000 · Passed")).toBeVisible();
  await expect(
    advancedRow.getByText(`Unlocks after passing ${examName} (70%)`)
  ).toHaveCount(0);

  // A second exam waits for its own modules: Basics' quiz was never done,
  // so it stays locked and cannot be taken (exam-locks.md AC-3, AC-5).
  const finalName = `Final exam ${suffix}`;
  await exams.getByRole("button", { name: "New exam" }).click();
  const finalForm = page.getByRole("dialog", { name: "New exam" });
  await finalForm.getByLabel("Title").fill(finalName);
  await finalForm.getByRole("checkbox", { name: new RegExp(basics) }).check();
  await finalForm.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const finalRow = exams.getByRole("row", { name: new RegExp(finalName) });
  await finalRow.getByLabel("More actions").click();
  await page.getByRole("menuitem", { name: "Unlock rule" }).click();
  const examRule = page.getByRole("dialog");
  await examRule
    .getByRole("radio", { name: "After finishing the exam's modules" })
    .click();
  await shot("6-exam-rule");
  await examRule.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(finalRow.getByText(`Unlocks after ${basics}`)).toBeVisible();
  await expect(finalRow.getByRole("button", { name: "Take exam" })).toHaveCount(
    0
  );
  await shot("7-locked-exam");
});
