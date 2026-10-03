import { useTranslation } from "react-i18next";
import { setAppLanguage } from "@/actions/language";
import langs from "@/localization/langs";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

export default function LangToggle() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  function onValueChange(value: string) {
    setAppLanguage(value, i18n);
  }

  return (
    <ToggleGroup
      onValueChange={onValueChange}
      type="single"
      value={currentLang}
    >
      {langs.map((lang) => (
        <ToggleGroupItem
          // The chosen language must stand out (docs/specs/audit-a11y-leftovers.md AC-3).
          className="data-[state=on]:border-brand/40 data-[state=on]:bg-brand/10 data-[state=on]:text-brand-text"
          key={lang.key}
          size="lg"
          value={lang.key}
          variant="outline"
        >
          {lang.nativeName}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
