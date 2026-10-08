import type { Language } from "./language";

/** Each by its own name, with a country's flag (docs/specs/settings-language-text-size-version.md AC-3). */
export default [
  {
    flag: "US",
    key: "en",
    nativeName: "English",
    prefix: "EN-US",
  },
  {
    flag: "BR",
    key: "pt-BR",
    nativeName: "Português",
    prefix: "PT-BR",
  },
  {
    flag: "ES",
    key: "es",
    nativeName: "Español",
    prefix: "ES",
  },
  {
    flag: "CN",
    key: "zh-CN",
    nativeName: "简体中文",
    prefix: "ZH-CN",
  },
  {
    flag: "SA",
    key: "ar",
    nativeName: "العربية",
    prefix: "AR",
  },
  {
    flag: "FR",
    key: "fr",
    nativeName: "Français",
    prefix: "FR",
  },
  {
    flag: "DE",
    key: "de",
    nativeName: "Deutsch",
    prefix: "DE",
  },
  {
    flag: "JP",
    key: "ja",
    nativeName: "日本語",
    prefix: "JA",
  },
  {
    flag: "KR",
    key: "ko",
    nativeName: "한국어",
    prefix: "KO",
  },
] as const satisfies Language[];
