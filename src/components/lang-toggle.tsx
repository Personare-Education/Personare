import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "@/actions/language";
import LanguageFlag from "@/components/language-flag";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import langs from "@/localization/langs";

type Lang = (typeof langs)[number];

function languageName(lang: Lang) {
  return lang.nativeName;
}

/**
 * The language, picked in a combobox: each by its own name, with its flag,
 * filtered by name (docs/specs/settings-language-text-size-version.md AC-1).
 */
export default function LangToggle() {
  const { i18n, t } = useTranslation();
  const current = langs.find((lang) => lang.key === i18n.language) ?? langs[0];
  // Inside a dialog (Settings), the list opens in the dialog itself: outside
  // it, the dialog blocks its clicks and pulls the focus off its search.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const handleTriggerRef = useCallback((node: HTMLElement | null) => {
    setContainer(
      node?.closest<HTMLElement>('[data-slot="dialog-content"]') ?? null
    );
  }, []);

  const handleValueChange = useCallback(
    (lang: Lang | null) => {
      if (lang) {
        setAppLanguage(lang.key, i18n);
      }
    },
    [i18n]
  );

  return (
    <Combobox
      items={langs}
      itemToStringLabel={languageName}
      onValueChange={handleValueChange}
      value={current}
    >
      <ComboboxTrigger
        aria-label={t("languageLabel")}
        className="w-56 justify-between"
        ref={handleTriggerRef}
        render={<Button size="lg" variant="outline" />}
      >
        <span className="flex items-center gap-2">
          <LanguageFlag code={current.flag} />
          {current.nativeName}
        </span>
      </ComboboxTrigger>
      <ComboboxContent container={container ?? undefined}>
        <ComboboxInput
          placeholder={t("languageSearchPlaceholder")}
          showTrigger={false}
        />
        <ComboboxEmpty>{t("languageEmptyMessage")}</ComboboxEmpty>
        <ComboboxList>
          {(lang: Lang) => (
            <ComboboxItem key={lang.key} value={lang}>
              <LanguageFlag code={lang.flag} />
              {lang.nativeName}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
