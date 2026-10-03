import { Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toggleTheme } from "@/actions/theme";
import { Button } from "@/components/ui/button";

export default function ToggleTheme() {
  const { t } = useTranslation();

  return (
    // docs/specs/audit-a11y.md AC-1: an icon alone has no name.
    <Button
      aria-label={t("toggleThemeAction")}
      onClick={toggleTheme}
      size="icon"
    >
      <Moon size={16} />
    </Button>
  );
}
