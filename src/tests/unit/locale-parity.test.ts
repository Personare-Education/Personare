import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ar from "@/localization/locales/ar";
import de from "@/localization/locales/de";
import en from "@/localization/locales/en";
import es from "@/localization/locales/es";
import fr from "@/localization/locales/fr";
import ja from "@/localization/locales/ja";
import ko from "@/localization/locales/ko";
import ptBR from "@/localization/locales/pt-br";
import zhCN from "@/localization/locales/zh-cn";

/**
 * docs/specs/locale-parity.md: every language has the same keys as
 * English, the plural forms its own grammar needs, the same
 * {{placeholders}}, and every key the code asks for exists.
 */

type Locale = Record<string, string>;

const LOCALES: [language: string, locale: Locale][] = [
  ["ar", ar],
  ["de", de],
  ["es", es],
  ["fr", fr],
  ["ja", ja],
  ["ko", ko],
  ["pt-BR", ptBR],
  ["zh-CN", zhCN],
];

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const PLACEHOLDER = /{{\s*(\w+)\s*}}/g;
const LITERAL_T_CALL = /\bt\(\s*"([A-Za-z0-9_]+)"/g;
const TYPESCRIPT_FILE = /\.tsx?$/;
const SRC = path.resolve(import.meta.dirname, "../..");

function baseKey(key: string): string {
  return key.replace(PLURAL_SUFFIX, "");
}

function baseKeys(locale: Locale): string[] {
  return [...new Set(Object.keys(locale).map(baseKey))].sort();
}

function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))].sort();
}

/** The English text a key is translated from (a plural's "other" form). */
function englishFor(key: string): string | undefined {
  const english = en as Locale;
  return english[key] ?? english[`${baseKey(key)}_other`];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "tests" || name === "localization"
        ? []
        : sourceFiles(full);
    }
    return TYPESCRIPT_FILE.test(name) ? [full] : [];
  });
}

describe.each(LOCALES)("%s", (language, locale) => {
  it("has the same keys as English", () => {
    expect(baseKeys(locale)).toEqual(baseKeys(en as Locale));
  });

  it("has every plural form its grammar needs", () => {
    const categories = new Intl.PluralRules(language).resolvedOptions()
      .pluralCategories;
    const plurals = [
      ...new Set(
        Object.keys(locale)
          .filter((key) => PLURAL_SUFFIX.test(key))
          .map(baseKey)
      ),
    ];
    const missing = plurals.flatMap((base) =>
      categories
        .map((category) => `${base}_${category}`)
        .filter((key) => !(key in locale))
    );
    expect(missing).toEqual([]);
  });

  it("keeps English's placeholders", () => {
    const mismatched = Object.entries(locale)
      .filter(([key, text]) => {
        const english = englishFor(key);
        if (english === undefined) {
          return false;
        }
        // A form like Arabic's "_one" may spell the number out instead of
        // using {{count}}; every other placeholder must still be there.
        const expected = placeholders(english).filter(
          (name) => !(name === "count" && PLURAL_SUFFIX.test(key))
        );
        const actual = placeholders(text);
        return expected.some((name) => !actual.includes(name));
      })
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });
});

describe("English", () => {
  it("has every key the code asks for by name", () => {
    const english = en as Locale;
    const missing = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      const code = readFileSync(file, "utf8");
      for (const [, key] of code.matchAll(LITERAL_T_CALL)) {
        if (!(key in english || `${key}_other` in english)) {
          missing.add(`${key} (${path.relative(SRC, file)})`);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
