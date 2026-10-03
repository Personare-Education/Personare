import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

vi.mock("@/actions/theme", () => ({
  toggleTheme: vi.fn(() => {
    document.documentElement.classList.toggle("dark");
    return Promise.resolve();
  }),
}));

const { default: ToggleTheme } = await import("@/components/toggle-theme");

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("ToggleTheme", () => {
  it("is a button with the moon icon", () => {
    render(<ToggleTheme />);

    const svg = screen.getByRole("button").querySelector("svg");
    expect(svg?.classList).toContain("lucide-moon");
  });

  /** docs/specs/audit-a11y.md AC-1 */
  it("has an accessible name", () => {
    render(<ToggleTheme />);

    expect(
      screen.getByRole("button", { name: i18n.t("toggleThemeAction") })
    ).toBeInTheDocument();
  });

  /** docs/specs/audit-a11y-leftovers.md AC-4 */
  it("says in words, and as its pressed state, whether the dark theme is on", async () => {
    const user = userEvent.setup();
    render(<ToggleTheme />);

    const button = screen.getByRole("button", {
      name: i18n.t("toggleThemeAction"),
    });
    expect(button).toHaveTextContent(i18n.t("toggleThemeAction"));
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("starts pressed when the dark theme is already on", () => {
    document.documentElement.classList.add("dark");
    render(<ToggleTheme />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});
