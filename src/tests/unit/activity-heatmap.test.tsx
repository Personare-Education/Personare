import { render, screen } from "@testing-library/react";
import { format, subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import "@/localization/i18n";

/**
 * RED phase (Issue #99, Spec Driven TDD): src/components/activity-heatmap.tsx
 * does not exist yet. Every test below is expected to fail until the
 * Developer implements it, per
 * docs/specs/issue-99-programs-cards-heatmap.md AC-4.
 */

describe("ActivityHeatmap (Issue #99)", () => {
  it("renders an accessible img role summarizing the total count in the window", () => {
    render(
      <ActivityHeatmap
        color="#ef4444"
        counts={[
          { count: 2, date: "2026-03-10" },
          { count: 3, date: "2026-03-11" },
        ]}
      />
    );

    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toContain("5");
  });

  it("renders without crashing when there is no activity at all", () => {
    render(<ActivityHeatmap color="#ef4444" counts={[]} />);

    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toContain("0");
  });
});

/**
 * RED phase (docs/specs/heatmap-fill-animation.md): the cells "fill in"
 * with the website's animation, from the most recent day to the oldest, and
 * only once the counts arrive.
 */
describe("ActivityHeatmap fill animation", () => {
  const COUNTS = [
    { count: 2, date: format(subDays(new Date(), 3), "yyyy-MM-dd") },
    { count: 5, date: format(subDays(new Date(), 10), "yyyy-MM-dd") },
  ];

  function cells(container: HTMLElement) {
    return Array.from(
      container.querySelectorAll<HTMLElement>("[aria-hidden='true'] > div")
    );
  }

  it("animates every cell once there are counts", () => {
    const { container } = render(
      <ActivityHeatmap color="#ef4444" counts={COUNTS} weeks={4} />
    );

    const dayCells = cells(container).filter((cell) =>
      cell.hasAttribute("title")
    );
    expect(dayCells.length).toBeGreaterThan(0);
    for (const cell of dayCells) {
      expect(cell).toHaveClass("heatmap-cell");
    }
  });

  it("does not animate an empty heatmap", () => {
    const { container } = render(
      <ActivityHeatmap color="#ef4444" counts={[]} weeks={4} />
    );

    expect(container.querySelector(".heatmap-cell")).toBeNull();
  });

  it("cascades from the most recent day to the oldest", () => {
    const { container } = render(
      <ActivityHeatmap color="#ef4444" counts={COUNTS} weeks={4} />
    );
    const weekColumns =
      container.querySelectorAll<HTMLElement>("[role='img'] > div");
    expect(container.querySelectorAll(".heatmap-cell").length).toBeGreaterThan(
      0
    );

    for (const [week, column] of Array.from(weekColumns).entries()) {
      const days = Array.from(column.children) as HTMLElement[];
      for (const [row, cell] of days.entries()) {
        if (!cell.classList.contains("heatmap-cell")) {
          continue;
        }
        // Most recent first: week 3 (the last of 4) and the last day of a
        // week have no delay.
        expect(cell.style.getPropertyValue("--col")).toBe(String(3 - week));
        expect(cell.style.getPropertyValue("--row")).toBe(
          String(days.length - 1 - row)
        );
      }
    }
  });

  it("replays the fill when the counts arrive, but not on later updates", () => {
    const { container, rerender } = render(
      <ActivityHeatmap color="#ef4444" counts={[]} weeks={4} />
    );
    const emptyGrid = container.querySelector("[aria-hidden='true']");

    rerender(<ActivityHeatmap color="#ef4444" counts={COUNTS} weeks={4} />);
    const filledGrid = container.querySelector("[aria-hidden='true']");
    expect(filledGrid).not.toBe(emptyGrid);

    rerender(
      <ActivityHeatmap
        color="#ef4444"
        counts={[...COUNTS, { count: 1, date: COUNTS[0].date }]}
        weeks={4}
      />
    );
    expect(container.querySelector("[aria-hidden='true']")).toBe(filledGrid);
  });
});
