import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

/*
 * Criterio de aceite 2 (Issue #1 - Rebranding):
 * package.json (author) e forge.config.ts (publisher) devem refletir a
 * identidade Personare (repositorio Personare-Education/Personare), sem
 * referencias a ROG/LuanRoger.
 */

const ROOT = path.resolve(import.meta.dirname, "../../..");

const ELECTRON_SHADCN_RE = /electron-shadcn/i;
const LUAN_ROGER_RE = /LuanRoger/i;
const FORGE_OWNER_RE = /owner:\s*["']Personare-Education["']/;
const FORGE_NAME_RE = /name:\s*["']Personare["']/;
const MAIN_REPO_RE = /repo:\s*["']Personare-Education\/Personare["']/;

test("package.json author reflects Personare identity, not LuanRoger", () => {
  const pkg = JSON.parse(
    readFileSync(path.join(ROOT, "package.json"), "utf-8")
  );

  expect(typeof pkg.author).toBe("string");
  expect(pkg.author.toLowerCase()).not.toContain("luanroger");
  expect(pkg.author.toLowerCase()).toContain("personare");
});

test("forge.config.ts publisher points to the Personare GitHub repository", () => {
  const forgeConfigSource = readFileSync(
    path.join(ROOT, "forge.config.ts"),
    "utf-8"
  );

  expect(forgeConfigSource).not.toMatch(ELECTRON_SHADCN_RE);
  expect(forgeConfigSource).not.toMatch(LUAN_ROGER_RE);
  expect(forgeConfigSource).toMatch(FORGE_OWNER_RE);
  expect(forgeConfigSource).toMatch(FORGE_NAME_RE);
});

test("src/main.ts auto-updater points to the Personare GitHub repository", () => {
  const mainSource = readFileSync(path.join(ROOT, "src", "main.ts"), "utf-8");

  expect(mainSource).not.toMatch(ELECTRON_SHADCN_RE);
  expect(mainSource).not.toMatch(LUAN_ROGER_RE);
  expect(mainSource).toMatch(MAIN_REPO_RE);
});
