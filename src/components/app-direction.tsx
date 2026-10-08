import { DirectionProvider as BaseDirectionProvider } from "@base-ui/react/direction-provider";
import type React from "react";
import { useTranslation } from "react-i18next";
import { DirectionProvider } from "@/components/ui/direction";

/**
 * The components follow the language's direction: right to left for Arabic
 * (docs/specs/settings-language-text-size-version.md AC-5). Radix's for most
 * of them, Base UI's for the combobox.
 */
export default function AppDirection({
  children,
}: {
  children: React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const direction = i18n.dir(i18n.language);

  return (
    <DirectionProvider dir={direction}>
      <BaseDirectionProvider direction={direction}>
        {children}
      </BaseDirectionProvider>
    </DirectionProvider>
  );
}
