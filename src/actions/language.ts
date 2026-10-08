import type { i18n } from "i18next";
import { LOCAL_STORAGE_KEYS } from "@/constants";

/**
 * The document's language and direction: Arabic reads right to left
 * (docs/specs/settings-language-text-size-version.md AC-5).
 */
function applyDocumentLanguage(lang: string, i18: i18n) {
  document.documentElement.lang = lang;
  document.documentElement.dir = i18.dir(lang);
}

export function setAppLanguage(lang: string, i18: i18n) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.LANGUAGE, lang);
  i18.changeLanguage(lang);
  applyDocumentLanguage(lang, i18);
}

export function updateAppLanguage(i18: i18n) {
  const localLang = localStorage.getItem(LOCAL_STORAGE_KEYS.LANGUAGE);
  if (!localLang) {
    return;
  }

  i18.changeLanguage(localLang);
  applyDocumentLanguage(localLang, i18);
}
