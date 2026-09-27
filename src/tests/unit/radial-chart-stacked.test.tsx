import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #122: o resultado do Quiz deve usar o "Radial Chart - Stacked" do
 * shadcn (semicirculo com secoes empilhadas), nao um anel de valor unico.
 *
 * Recharts' ResponsiveContainer measures its container via
 * getBoundingClientRect() before its first render; jsdom always reports 0x0,
 * so without this override the chart (and its centered text) never mounts.
 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    bottom: 300,
    height: 300,
    left: 0,
    right: 300,
    toJSON: () => undefined,
    top: 0,
    width: 300,
    x: 0,
    y: 0,
  });
});

const { RadialChartStacked } = await import(
  "@/components/radial-chart-stacked"
);

const segments = [
  { color: "var(--chart-2)", key: "correct", label: "Correct", value: 3 },
  {
    color: "var(--destructive)",
    key: "incorrect",
    label: "Incorrect",
    value: 1,
  },
];

describe("RadialChartStacked (Issue #122)", () => {
  it("renders the center label and sublabel", () => {
    render(
      <RadialChartStacked
        centerLabel="75%"
        centerSublabel="3 of 4 correct"
        segments={segments}
      />
    );

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3 of 4 correct")).toBeInTheDocument();
  });

  it("stacks one radial bar per segment", () => {
    const { container } = render(
      <RadialChartStacked centerLabel="75%" segments={segments} />
    );

    expect(
      container.querySelectorAll(".recharts-radial-bar-sectors")
    ).toHaveLength(2);
  });
});
