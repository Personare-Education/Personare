import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar";
import de from "./locales/de";
import en from "./locales/en";
import es from "./locales/es";
import fr from "./locales/fr";
import ja from "./locales/ja";
import ko from "./locales/ko";
import ptBR from "./locales/pt-br";
import zhCN from "./locales/zh-cn";

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  resources: {
    ar: { translation: ar },
    de: { translation: de },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    ja: { translation: ja },
    ko: { translation: ko },
    "pt-BR": { translation: ptBR },
    "zh-CN": { translation: zhCN },
  },
});
