import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRetentionStats } from "@/actions/stats";

/** Fewer than this says more about luck than memory (AC-3). */
export const MIN_ATTEMPTS = 20;

interface RetentionStats {
  attempts: number;
  desiredRetention: number;
  remembered: number;
}

function percent(value: number) {
  return Math.round(value * 100);
}

/**
 * Today, once the day is done: how much the student remembered in the last
 * 30 days, next to the target FSRS schedules for -- the system's reasoning,
 * shown (PRODUCT.md principle 4; docs/specs/retention-summary.md).
 */
export default function RetentionSummary() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<RetentionStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRetentionStats()
      .then((value) => {
        if (!cancelled) {
          setStats(value);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats || stats.attempts < MIN_ATTEMPTS) {
    return null;
  }

  const actual = percent(stats.remembered / stats.attempts);
  const target = percent(stats.desiredRetention);

  return (
    <section
      aria-label={t("retentionSummaryTitle")}
      className="flex flex-col gap-2"
    >
      <h2 className="font-medium text-sm">{t("retentionSummaryTitle")}</h2>
      <p className="flex items-baseline gap-2">
        <span className="font-medium font-serif text-3xl tabular-nums leading-none">
          {actual}%
        </span>
        <span className="text-muted-foreground text-sm">
          {t("retentionSummaryRemembered", { count: stats.attempts })}
        </span>
      </p>
      {/* Where the target sits on the same bar as what was remembered. */}
      <div
        aria-hidden="true"
        className="relative h-1.5 w-full max-w-md overflow-hidden rounded-full bg-foreground/5"
      >
        <span
          className="absolute inset-y-0 start-0 rounded-full bg-brand"
          style={{ width: `${actual}%` }}
        />
        <span
          className="absolute inset-y-0 w-0.5 bg-foreground/60"
          style={{ insetInlineStart: `${target}%` }}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        {t("retentionSummaryTarget", { target })}
      </p>
    </section>
  );
}
