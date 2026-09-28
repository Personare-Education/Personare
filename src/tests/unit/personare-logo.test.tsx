import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import PersonareLogo from "@/components/personare-logo";

/*
 * Spec: docs/specs/app-icon.md -- the app shows Personare's logo (from the
 * website): a 2x2 grid of rounded squares, three in the foreground color at
 * rising opacity and the last in the brand blue.
 */
it("draws the 2x2 grid, the last square in the brand color", () => {
  const { container } = render(<PersonareLogo className="size-6" />);

  const svg = container.querySelector("svg");
  const squares = container.querySelectorAll("rect");
  expect(svg).toHaveAttribute("aria-hidden", "true");
  expect(svg).toHaveClass("size-6");
  expect(squares).toHaveLength(4);
  expect(squares[3]).toHaveClass("fill-brand");
});
