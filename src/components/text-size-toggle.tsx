import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getTextSize,
  setTextSize,
  TEXT_SIZE_ORDER,
  type TextSize,
} from "@/actions/text-size";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const TEXT_SIZE_LABEL_KEYS: Record<TextSize, string> = {
  default: "textSizeDefault",
  large: "textSizeLarge",
  larger: "textSizeLarger",
  small: "textSizeSmall",
};

/**
 * Small, Default, Large, Larger: the whole app's text, applied at once and
 * remembered (docs/specs/text-size.md).
 */
export default function TextSizeToggle() {
  const { t } = useTranslation();
  const [size, setSize] = useState<TextSize>(getTextSize);

  const handleValueChange = useCallback((value: string) => {
    // A single toggle group reports "" when the pressed item is clicked again.
    if (!value) {
      return;
    }
    const next = value as TextSize;
    setTextSize(next);
    setSize(next);
  }, []);

  return (
    <ToggleGroup
      aria-label={t("textSizeLabel")}
      onValueChange={handleValueChange}
      type="single"
      value={size}
    >
      {TEXT_SIZE_ORDER.map((key) => (
        <ToggleGroupItem
          className="data-[state=on]:border-brand/40 data-[state=on]:bg-brand/10 data-[state=on]:text-brand-text"
          key={key}
          size="lg"
          value={key}
          variant="outline"
        >
          {t(TEXT_SIZE_LABEL_KEYS[key])}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
