import { useCallback, useMemo } from "react";
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
  centerLabel: string;
  centerSublabel?: string;
  className?: string;
  segments: RadialChartStackedSegment[];
}

/**
 * shadcn's "Radial Chart - Stacked": a half ring whose sections are stacked
 * left to right in `segments` order, with a label in the middle.
 */
export function RadialChartStacked({
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

  const renderCenterLabel = useCallback(
    ({ viewBox }: LabelProps) => {
      if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
        return null;
      }

      return (
        <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
          <tspan
            className="fill-foreground font-bold text-2xl"
            x={viewBox.cx}
            y={viewBox.cy - 16}
          >
            {centerLabel}
          </tspan>
          {centerSublabel ? (
            <tspan
              className="fill-muted-foreground"
              x={viewBox.cx}
              y={viewBox.cy + 4}
            >
              {centerSublabel}
            </tspan>
          ) : null}
        </text>
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
        {segments.map((segment) => (
          <RadialBar
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
