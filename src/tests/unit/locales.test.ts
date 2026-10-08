import i18n from "i18next";
import { describe, expect, it } from "vitest";
import "@/localization/i18n";
import langs from "@/localization/langs";

/**
 * RED phase (docs/specs/settings-language-text-size-version.md AC-3, AC-4):
 * nine languages, each by its own name with a country's flag, and every one
 * translated in full: the English keys, the same variables, and the plural
 * forms the language uses.
 */

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;

type Strings = Record<string, string>;

function strings(lang: string): Strings {
  return (i18n.getResourceBundle(lang, "translation") ?? {}) as Strings;
}

function variables(text: string): string[] {
  return [...text.matchAll(VARIABLE)].map((match) => match[1]).sort();
}

const english = strings("en");
const englishKeys = Object.keys(english);
/** The keys with plural forms, by their base ("rankPoints" for rankPoints_one). */
const pluralBases = new Set(
  englishKeys
    .filter((key) => PLURAL_SUFFIX.test(key) && !key.endsWith("_zero"))
    .map((key) => key.replace(PLURAL_SUFFIX, ""))
);
const singleKeys = englishKeys.filter(
  (key) => !pluralBases.has(key.replace(PLURAL_SUFFIX, ""))
);

describe("languages", () => {
  it("lists the nine languages by their own names, each with a flag", () => {
    expect(
      langs.map(({ flag, key, nativeName }) => [key, nativeName, flag])
    ).toEqual([
      ["en", "English", "US"],
      ["pt-BR", "Português", "BR"],
      ["es", "Español", "ES"],
      ["zh-CN", "简体中文", "CN"],
      ["ar", "العربية", "SA"],
      ["fr", "Français", "FR"],
      ["de", "Deutsch", "DE"],
      ["ja", "日本語", "JP"],
      ["ko", "한국어", "KR"],
    ]);
  });

  describe.each(langs.map((lang) => lang.key).filter((key) => key !== "en"))(
    "%s",
    (lang) => {
      const translated = strings(lang);

      it("has every English text, with the same variables", () => {
        const missing = singleKeys.filter((key) => !translated[key]);
        expect(missing).toEqual([]);
        const mismatched = singleKeys.filter(
          (key) =>
            translated[key] &&
            variables(translated[key]).join() !== variables(english[key]).join()
        );
        expect(mismatched).toEqual([]);
      });

      it("has every plural form the language uses", () => {
        const categories = new Intl.PluralRules(lang).resolvedOptions()
          .pluralCategories;
        // English's own "_zero" texts ("No cards saved yet") too.
        const zeros = englishKeys.filter((key) => key.endsWith("_zero"));
        const missing = [
          ...[...pluralBases].flatMap((base) =>
            categories.map((category) => `${base}_${category}`)
          ),
          ...zeros,
        ].filter((key) => !translated[key]);
        expect(missing).toEqual([]);
      });

      it("has no text English does not have", () => {
        const extra = Object.keys(translated).filter(
          (key) =>
            !(key in english || pluralBases.has(key.replace(PLURAL_SUFFIX, "")))
        );
        expect(extra).toEqual([]);
      });
    }
  );
});
