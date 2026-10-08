import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * A padlock and what is missing to unlock, beside a locked item's name
 * (docs/specs/sequences-and-locks.md §4 AC-2).
 */
export default function LockLabel({ label }: { label: string }) {
  const { t } = useTranslation();

  return (
    <span className="inline-flex items-start gap-1 font-normal text-muted-foreground text-xs">
      <Lock
        aria-label={t("lockedLabel")}
        // On the first line when a long label wraps.
        className="mt-px size-3.5 shrink-0"
        role="img"
      />
      {label}
    </span>
  );
}
