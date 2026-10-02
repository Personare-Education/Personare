import {
  type CSSProperties,
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { buildHeatmapWeeks, type HeatmapLevel } from "@/utils/activity-heatmap";
import { cn } from "@/utils/tailwind";

export interface ActivityHeatmapProps {
  color: string;
  counts: { count: number; date: string }[];
  weeks?: number;
}

/**
 * Values come from --heatmap-level-1..4 (src/styles/global.css), not fixed
 * numbers here: the same opacity reads as a washed-out pastel over a light
 * theme's white card but a rich tint over a dark one, so light mode needs
 * higher opacities for the same perceived intensity.
 */
const LEVEL_OPACITY: Record<HeatmapLevel, string> = {
  0: "0",
  1: "var(--heatmap-level-1)",
  2: "var(--heatmap-level-2)",
  3: "var(--heatmap-level-3)",
  4: "var(--heatmap-level-4)",
};

export function ActivityHeatmap({
  color,
  counts,
  weeks,
}: ActivityHeatmapProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const heatmapWeeks = useMemo(
    () => buildHeatmapWeeks(counts, { weeks }),
    [counts, weeks]
  );
  const total = useMemo(
    () => counts.reduce((sum, day) => sum + day.count, 0),
    [counts]
  );

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const updateScrollability = () => {
      const scrollable = node.scrollWidth > node.clientWidth;
      setIsScrollable(scrollable);

      if (scrollable) {
        node.scrollLeft = node.scrollWidth;
      }
    };

    updateScrollability();

    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateScrollability);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  // AC-3: animate once the counts arrive. The cells are remounted (a new
  // key) only when going from no data to data, so a later update -- another
  // review done -- does not replay it.
  const hasCounts = total > 0;

  return (
    <div
      aria-label={t("programActivityHeatmapSummary", { count: total })}
      className={cn(
        "no-scrollbar flex gap-[3px] overflow-x-auto",
        isScrollable &&
          "[mask-image:linear-gradient(to_right,transparent,black_24px)]"
      )}
      ref={scrollRef}
      role="img"
    >
      <Fragment key={hasCounts ? "filled" : "empty"}>
        {heatmapWeeks.map((week, weekIndex) => (
          <div
            aria-hidden="true"
            className="flex shrink-0 flex-col gap-[3px]"
            // biome-ignore lint/suspicious/noArrayIndexKey: weeks/days are a fixed-size grid, never reordered.
            key={weekIndex}
          >
            {week.map((day, dayIndex) => (
              <div
                className={cn(
                  "size-2.5 rounded-xs",
                  day ? undefined : "bg-transparent",
                  day && hasCounts && "heatmap-cell"
                )}
                key={day?.date ?? dayIndex}
                style={
                  day
                    ? ({
                        // Most recent first (AC-2): the delay grows with
                        // the day's age, week by week, then day by day.
                        "--col": heatmapWeeks.length - 1 - weekIndex,
                        "--row": week.length - 1 - dayIndex,
                        backgroundColor:
                          day.level === 0 ? "var(--heatmap-empty-cell)" : color,
                        opacity: day.level === 0 ? 1 : LEVEL_OPACITY[day.level],
                      } as CSSProperties)
                    : undefined
                }
                title={day ? `${day.date}: ${day.count}` : undefined}
              />
            ))}
          </div>
        ))}
      </Fragment>
    </div>
  );
}
