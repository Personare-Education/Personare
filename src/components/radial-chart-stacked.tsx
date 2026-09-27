import { type ReactNode, useCallback, useMemo } from "react";
import {
  Label,
  type LabelProps,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/utils/tailwind";

export interface RadialChartStackedSegment {
  color: string;
  key: string;
  label: string;
  value: number;
}

export interface RadialChartStackedProps {
  /** How long the whole ring takes to fill, in milliseconds. */
  animationDuration?: number;
  centerLabel: ReactNode;
  centerSublabel?: string;
  className?: string;
  segments: RadialChartStackedSegment[];
}

export interface RadialChartStackedSegmentAnimation {
  begin: number;
  duration: number;
  easing: "ease" | "ease-in" | "ease-out" | "linear";
}

const DEFAULT_ANIMATION_DURATION = 1500;

/**
 * Fills the ring left to right as one sweep: each segment starts when the
 * previous one ends, taking a share of `duration` proportional to its value.
 * Only the first segment eases in and the last eases out, so the sweep keeps
 * its pace across the handover between segments.
 */
export function getSegmentAnimations(
  segments: RadialChartStackedSegment[],
  duration: number
): RadialChartStackedSegmentAnimation[] {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const filledIndexes = segments.flatMap((segment, index) =>
    segment.value > 0 ? [index] : []
  );
  const [firstFilled] = filledIndexes;
  const lastFilled = filledIndexes.at(-1);

  let begin = 0;
  return segments.map((segment, index) => {
    const segmentDuration =
      total === 0 ? 0 : (segment.value / total) * duration;
    let easing: RadialChartStackedSegmentAnimation["easing"] = "linear";
    if (segmentDuration > 0) {
      if (index === firstFilled && index === lastFilled) {
        easing = "ease";
      } else if (index === firstFilled) {
        easing = "ease-in";
      } else if (index === lastFilled) {
        easing = "ease-out";
      }
    }
    const animation = { begin, duration: segmentDuration, easing };
    begin += segmentDuration;
    return animation;
  });
}

const CENTER_LABEL_WIDTH = 140;
const CENTER_LABEL_HEIGHT = 56;

/**
 * shadcn's "Radial Chart - Stacked": a half ring whose sections are stacked
 * left to right in `segments` order, with a label in the middle.
 */
export function RadialChartStacked({
  animationDuration = DEFAULT_ANIMATION_DURATION,
  centerLabel,
  centerSublabel,
  className,
  segments,
}: RadialChartStackedProps) {
  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        segments.map((segment) => [
          segment.key,
          { color: segment.color, label: segment.label },
        ])
      ) satisfies ChartConfig,
    [segments]
  );
  const chartData = useMemo(
    () => [
      Object.fromEntries(
        segments.map((segment) => [segment.key, segment.value])
      ),
    ],
    [segments]
  );

  // The angle scale must span the stacked total; left to Recharts it follows
  // the largest single segment, pushing the later sections off the ring.
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const segmentAnimations = useMemo(
    () => getSegmentAnimations(segments, animationDuration),
    [animationDuration, segments]
  );

  const renderCenterLabel = useCallback(
    ({ viewBox }: LabelProps) => {
      if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
        return null;
      }

      // HTML inside the ring (not SVG <text>), so the label can be any
      // React node -- a count up, for one.
      return (
        <foreignObject
          height={CENTER_LABEL_HEIGHT}
          width={CENTER_LABEL_WIDTH}
          x={viewBox.cx - CENTER_LABEL_WIDTH / 2}
          y={viewBox.cy - CENTER_LABEL_HEIGHT}
        >
          <div className="flex h-full flex-col items-center justify-end pb-1">
            <span className="font-bold text-2xl text-foreground tabular-nums">
              {centerLabel}
            </span>
            {centerSublabel ? (
              <span className="text-muted-foreground">{centerSublabel}</span>
            ) : null}
          </div>
        </foreignObject>
      );
    },
    [centerLabel, centerSublabel]
  );

  return (
    <ChartContainer
      // An explicit width: in a flex `items-center` parent the container would
      // otherwise shrink to Recharts' ResponsiveContainer, which sizes itself
      // from this same box -- ending up 0x0 and drawing nothing. The negative
      // margin trims the empty lower half of the square under the half ring.
      className={cn(
        "mx-auto -mb-24 aspect-square w-full max-w-[250px]",
        className
      )}
      config={chartConfig}
    >
      <RadialBarChart
        data={chartData}
        // Recharts measures angles counterclockwise from 3 o'clock: 180 -> 0
        // draws the half ring from the left end to the right end.
        endAngle={0}
        innerRadius={80}
        outerRadius={110}
        startAngle={180}
      >
        <PolarAngleAxis domain={[0, total || 1]} tick={false} type="number" />
        <ChartTooltip
          content={<ChartTooltipContent hideLabel />}
          cursor={false}
        />
        {segments.map((segment, index) => (
          <RadialBar
            animationBegin={segmentAnimations[index].begin}
            animationDuration={segmentAnimations[index].duration}
            animationEasing={segmentAnimations[index].easing}
            className="stroke-2 stroke-transparent"
            cornerRadius={5}
            dataKey={segment.key}
            fill={`var(--color-${segment.key})`}
            key={segment.key}
            stackId="a"
          />
        ))}
        <PolarRadiusAxis axisLine={false} tick={false} tickLine={false}>
          <Label content={renderCenterLabel} />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  );
}
