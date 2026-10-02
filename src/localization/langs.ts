import type { Language } from "./language";

export default [
  {
    key: "en",
    nativeName: "English",
    prefix: "EN-US",
  },
  {
    key: "pt-BR",
    nativeName: "Português",
    prefix: "PT-BR",
  },
] as const satisfies Language[];
