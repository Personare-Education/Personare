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
 * Importing a whole program end to end (docs/specs/program-import.md): the
 * AI's file pasted in, previewed as a tree, imported and opened.
 */

let electronApp: ElectronApplication;
let page: Page;

const SCREENSHOTS = process.env.EXAMS_SCREENSHOTS;
const BASICS_ROW = /^Basics/;
const HASHING_ROW = /^Hashing/;
const EXAM_ROW = /^Exam 1/;

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

test("imports a whole program pasted from an AI and opens it", async () => {
  const name = `Imported ${Date.now()}`;
  const file = `Sure! Here is your program:

\`\`\`markdown
# Program: ${name}

## Module: Basics

### Link: Complexity lesson
https://example.com/lesson

### Quiz: Complexity check
Binary search?
- [x] O(log n)
- [ ] O(n)

### Flashcards: Terms
Front: Big-O
Back: Upper bound

## Module: Hashing
Unlocks after: Basics

### Sequence: Hashing review
Order: lock

#### Link: Handout
https://example.com/handout

#### Quiz: Collisions
What is a collision?
- [x] Two keys in one bucket
- [ ] Nothing

## Exam: Exam 1
Modules: Basics; Hashing
Questions: 2
Unlocks after: the exam's modules

Which is FIFO?
- [x] Queue
- [ ] Stack
\`\`\`
`;

  await sidebarLink(page, "Programs").click();
  await page.getByRole("button", { name: "Import program" }).click();
  const dialog = page.getByRole("dialog", { name: "Import a program" });
  await dialog.getByLabel("What is the program about?").fill("Algorithms");
  await shot("import-1-prompt");
  await dialog.getByRole("button", { name: "I have the file" }).click();
  await dialog.getByLabel("Or paste the text").fill(file);
  await dialog.getByRole("button", { name: "See preview" }).click();

  // The preview, before anything is saved (§3 AC-2).
  await expect(
    dialog.getByText(`Creates the program “${name}”.`)
  ).toBeVisible();
  await expect(
    dialog
      .getByRole("listitem", { name: "Hashing" })
      .getByText("Unlocks after: Basics")
  ).toBeVisible();
  await expect(
    dialog.getByRole("listitem", { name: "Collisions" })
  ).toBeVisible();
  await shot("import-2-preview");
  await dialog.getByRole("button", { exact: true, name: "Import" }).click();

  // Opened, with everything in it (§3 AC-3).
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText(`Program “${name}” imported`)).toBeVisible();
  await expect(page.getByRole("row", { name: BASICS_ROW })).toBeVisible();
  await expect(
    page
      .getByRole("row", { name: HASHING_ROW })
      .getByText("Unlocks after Basics")
  ).toBeVisible();
  await expect(page.getByRole("row", { name: EXAM_ROW })).toBeVisible();
  await shot("import-3-program");
});
