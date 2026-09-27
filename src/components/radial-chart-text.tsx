import { useCallback } from "react";
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { cn } from "@/utils/tailwind";

interface CenterLabelViewBox {
  cx?: number;
  cy?: number;
}

export interface RadialChartTextProps {
  centerLabel: string;
  centerSublabel?: string;
  className?: string;
  value: number;
}

const chartConfig = {
  value: {
    color: "var(--chart-2)",
    label: "Value",
  },
} satisfies ChartConfig;

export function RadialChartText({
  centerLabel,
  centerSublabel,
  className,
  value,
}: RadialChartTextProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const endAngle = 90 - (clampedValue / 100) * 360;
  const chartData = [{ fill: "var(--color-value)", value: clampedValue }];

  const renderCenterLabel = useCallback(
    ({ viewBox }: { viewBox?: CenterLabelViewBox }) => {
      if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
        return null;
      }

      return (
        <text
          dominantBaseline="middle"
          textAnchor="middle"
          x={viewBox.cx}
          y={viewBox.cy}
        >
          <tspan
            className="fill-foreground font-bold text-3xl"
            x={viewBox.cx}
            y={viewBox.cy}
          >
            {centerLabel}
          </tspan>
          {centerSublabel ? (
            <tspan
              className="fill-muted-foreground"
              x={viewBox.cx}
              y={(viewBox.cy ?? 0) + 24}
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
      // from this same box -- ending up 0x0 and drawing nothing (Issue #122).
      className={cn("mx-auto aspect-square w-full max-w-[200px]", className)}
      config={chartConfig}
    >
      <RadialBarChart
        data={chartData}
        endAngle={endAngle}
        innerRadius={70}
        outerRadius={100}
        startAngle={90}
      >
        <PolarGrid
          className="first:fill-muted last:fill-background"
          gridType="circle"
          polarRadius={[76, 64]}
          radialLines={false}
          stroke="none"
        />
        <RadialBar background cornerRadius={10} dataKey="value" />
        <PolarRadiusAxis axisLine={false} tick={false} tickLine={false}>
          <Label content={renderCenterLabel} />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  );
}
