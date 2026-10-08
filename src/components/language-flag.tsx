import {
  BR,
  CN,
  DE,
  ES,
  FR,
  JP,
  KR,
  SA,
  US,
} from "country-flag-icons/react/3x2";
import { cn } from "@/utils/tailwind";

/**
 * SVG, as Windows draws no flag emojis
 * (docs/specs/settings-language-text-size-version.md AC-3).
 */
const FLAGS = { BR, CN, DE, ES, FR, JP, KR, SA, US };

export type FlagCode = keyof typeof FLAGS;

export default function LanguageFlag({
  className,
  code,
}: {
  className?: string;
  code: FlagCode;
}) {
  const Flag = FLAGS[code];

  return (
    <Flag
      aria-hidden
      className={cn(
        "h-3 w-4.5 shrink-0 rounded-[2px] ring-1 ring-foreground/10",
        className
      )}
      data-testid={`flag-${code}`}
    />
  );
}
