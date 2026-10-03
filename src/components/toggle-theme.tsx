import { Moon } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toggleTheme } from "@/actions/theme";
import { Button } from "@/components/ui/button";

function isDarkThemeOn(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * "Dark theme", on or off: the state in words and as aria-pressed, where an
 * icon alone said neither (docs/specs/audit-a11y-leftovers.md AC-4).
 */
export default function ToggleTheme() {
  const { t } = useTranslation();
  const [isDark, setIsDark] = useState(isDarkThemeOn);

  const handleClick = useCallback(() => {
    Promise.resolve(toggleTheme()).then(() => setIsDark(isDarkThemeOn()));
  }, []);

  return (
    <Button
      aria-pressed={isDark}
      className="self-start aria-pressed:border-brand/40 aria-pressed:bg-brand/10 aria-pressed:text-brand-text"
      onClick={handleClick}
      variant="outline"
    >
      <Moon />
      {t("toggleThemeAction")}
    </Button>
  );
}
