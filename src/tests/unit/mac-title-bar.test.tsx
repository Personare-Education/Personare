import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MAC_TITLE_BAR_HEIGHT, macTrafficLightPosition } from "@/constants";

vi.mock("@/actions/app", () => ({
  getPlatform: vi.fn(),
}));
vi.mock("@/actions/window", () => ({
  closeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  minimizeWindow: vi.fn(),
}));

const { getPlatform } = await import("@/actions/app");
const { default: DragWindowRegion } = await import(
  "@/components/drag-window-region"
);

/**
 * RED phase (docs/specs/mac-traffic-lights.md): on macOS the window's
 * buttons sit centered in a top strip of their own, away from the corner.
 */

/** macOS's close/minimize/zoom buttons are about 14 px tall. */
const TRAFFIC_LIGHT_SIZE = 14;

describe("macOS title bar", () => {
  it("centers the buttons in the strip, away from the rounded corner (AC-2, AC-3)", () => {
    const { x, y } = macTrafficLightPosition();

    expect(y + TRAFFIC_LIGHT_SIZE / 2).toBe(MAC_TITLE_BAR_HEIGHT / 2);
    expect(x).toBeGreaterThanOrEqual(16);
  });

  it("gives the strip its fixed height on macOS (AC-1)", async () => {
    vi.mocked(getPlatform).mockResolvedValue("darwin");
    const { container } = render(<DragWindowRegion />);

    await waitFor(() => {
      const strip = container.querySelector(
        "[data-slot='mac-title-bar']"
      ) as HTMLElement;
      expect(strip).not.toBeNull();
      expect(strip.style.height).toBe(`${MAC_TITLE_BAR_HEIGHT}px`);
    });
  });

  it("leaves Windows and Linux as they were (AC-4)", async () => {
    vi.mocked(getPlatform).mockResolvedValue("win32");
    const { container, getByTitle } = render(<DragWindowRegion />);

    await waitFor(() => expect(getByTitle("Minimize")).toBeInTheDocument());
    expect(container.querySelector("[data-slot='mac-title-bar']")).toBeNull();
  });
});
