import fs from "node:fs";
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
import { freshProfileArg } from "./fresh-profile";

/**
 * Spec: docs/specs/calendar-module-review-highlight.md -- the calendar shows
 * module names and walks the user from an event to the program (module
 * pulsing), then to the module (activity pulsing); pending reviews pulse
 * without the calendar too, overdue ones in red with a clock; programs,
 * modules and back animate like a navigation stack.
 *
 * A real review comes from taking and rating a quiz. "Today" and "overdue"
 * are then reached by moving the renderer's clock to that review's due day
 * and past it (page.clock.setFixedTime), instead of editing the database.
 */

let electronApp: ElectronApplication;
let page: Page;
let quizFile: string;

const QUIZ_MARKDOWN = `## Question 1
What is 2 + 2?

- [ ] 3
- [x] 4
`;

const DAY_MS = 24 * 60 * 60 * 1000;
const IMPORT_FROM_AI = /Import from an AI/;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The view transition types each navigation asked for, recorded in the page. */
interface TransitionRecorder {
  stackTransitions: string[][];
}

test.beforeAll(async () => {
  const appInfo = parseElectronApp(findLatestBuild());
  process.env.CI = "e2e";

  quizFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "calendar-quiz-")),
    "quiz.md"
  );
  fs.writeFileSync(quizFile, QUIZ_MARKDOWN);

  electronApp = await electron.launch({
    args: [appInfo.main, freshProfileArg()],
  });
  page = await electronApp.firstWindow();
  await electronApp.evaluate(({ shell }) => {
    shell.openExternal = () => Promise.resolve();
  });
});

test.afterAll(async () => {
  // See activities-navigation.test.ts for why app.exit() instead of close().
  await electronApp.evaluate(({ app }) => app.exit());
  fs.rmSync(path.dirname(quizFile), { force: true, recursive: true });
});

async function recordStackTransitions(): Promise<void> {
  await page.evaluate(() => {
    const recorder = window as unknown as TransitionRecorder;
    recorder.stackTransitions = [];
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((
      options: Parameters<typeof document.startViewTransition>[0]
    ) => {
      if (options && typeof options === "object" && "types" in options) {
        recorder.stackTransitions.push([...(options.types ?? [])]);
      }
      return start(options);
    }) as typeof document.startViewTransition;
  });
}

function stackTransitions(): Promise<string[][]> {
  return page.evaluate(
    () => (window as unknown as TransitionRecorder).stackTransitions
  );
}

test("walks from a calendar event to the pulsing module and activity", async () => {
  const uniqueSuffix = Date.now();
  const programName = `E2E Calendar Program ${uniqueSuffix}`;
  const moduleName = `E2E Calendar Module ${uniqueSuffix}`;
  const quizName = `E2E Calendar Quiz ${uniqueSuffix}`;
  await recordStackTransitions();

  // Program > module > quiz, pushing a level deeper each time.
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
  await page.getByRole("row", { name: new RegExp(moduleName) }).click();
  await expect(
    page.getByRole("button", { name: "New activity" })
  ).toBeVisible();
  expect(await stackTransitions()).toEqual([["stack-push"], ["stack-push"]]);

  await page.getByRole("button", { name: "New activity" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(quizName);
  await dialog.getByRole("radio", { name: "Quiz" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("radio", { name: IMPORT_FROM_AI }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog
    .getByLabel("Drag the .md file here or click to choose")
    .setInputFiles(quizFile);
  await dialog.getByRole("button", { name: "Create quiz (1)" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Take and rate it: that schedules its next review.
  const quizRow = page.getByRole("row", { name: new RegExp(quizName) });
  await quizRow.click();
  const runner = page.getByRole("dialog", { name: quizName });
  await runner.getByRole("radio").nth(1).click();
  // Each answer is confirmed first (docs/specs/quiz-immediate-feedback.md).
  await runner.getByRole("button", { name: "Check answer" }).click();
  await runner.getByRole("button", { name: "Finish quiz" }).click();
  await runner.getByRole("button", { name: "Close" }).click();
  // An activity is rated on its own scale (docs/specs/rating-clarity.md).
  await page.getByRole("button", { name: "Didn't get it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The cell reads "In N days"; its <time> carries the exact day
  // (docs/specs/rating-clarity.md AC-3).
  const dueDay =
    (await quizRow
      .getByRole("cell")
      .nth(3)
      .locator("time")
      .getAttribute("datetime")) ?? "";
  expect(dueDay).toMatch(DAY_KEY);
  const dueNoon = new Date(`${dueDay}T12:00:00`);

  // Back up to the program is a pop; the module is not due yet.
  await page.getByRole("link", { name: programName }).click();
  const moduleRow = page.getByRole("row", { name: new RegExp(moduleName) });
  await expect(moduleRow).toBeVisible();
  expect((await stackTransitions()).at(-1)).toEqual(["stack-pop"]);
  await expect(moduleRow).not.toHaveAttribute("data-review-highlight");

  // On its due day, the calendar shows the module's name.
  await page.clock.setFixedTime(dueNoon);
  await page.getByRole("link", { exact: true, name: "Calendar" }).click();
  // The agenda lists every event; a busy month cell folds some into "+N more".
  await page.getByRole("button", { name: "Select view" }).click();
  await page.getByRole("menuitem", { name: "Agenda" }).click();
  const event = page.getByRole("button", { name: moduleName });
  await expect(event).toBeVisible();
  await expect(page.getByRole("button", { name: quizName })).toHaveCount(0);

  // The event opens the program with the module pulsing...
  await event.click();
  await expect(moduleRow).toHaveAttribute("data-review-highlight", "today");
  await page.screenshot({
    path: path.join(os.tmpdir(), "calendar-review-program.png"),
  });

  // ...then the module with the quiz pulsing -- on its own after 2.5
  // seconds, or right away when the user opens the module before that.
  await moduleRow.click();
  await expect(
    page.getByRole("button", { name: "New activity" })
  ).toBeVisible();
  await expect(quizRow).toHaveAttribute("data-review-highlight", "today");
  await page.screenshot({
    path: path.join(os.tmpdir(), "calendar-review-module.png"),
  });

  // Days later, still not done: overdue, red, with a clock beside the row.
  await page.clock.setFixedTime(new Date(dueNoon.getTime() + 3 * DAY_MS));
  await page.getByRole("link", { exact: true, name: "Programs" }).click();
  await page.getByRole("button", { name: new RegExp(programName) }).click();
  await expect(moduleRow).toHaveAttribute("data-review-highlight", "overdue");
  await expect(
    page.locator('[data-slot="overdue-review-marker"]')
  ).toBeVisible();
  await page.screenshot({
    path: path.join(os.tmpdir(), "calendar-review-overdue.png"),
  });
});
