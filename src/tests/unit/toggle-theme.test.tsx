import { render } from "@testing-library/react";
import i18n from "i18next";
import { expect, test } from "vitest";
import ToggleTheme from "@/components/toggle-theme";
import "@/localization/i18n";

test("renders ToggleTheme", () => {
  const { getByRole } = render(<ToggleTheme />);
  const isButton = getByRole("button");

  expect(isButton).toBeInTheDocument();
});

test("has icon", () => {
  const { getByRole } = render(<ToggleTheme />);
  const button = getByRole("button");
  const icon = button.querySelector("svg");

  expect(icon).toBeInTheDocument();
});

test("is moon icon", () => {
  const svgIconClassName: string = "lucide-moon";
  const { getByRole } = render(<ToggleTheme />);
  const svg = getByRole("button").querySelector("svg");

  expect(svg?.classList).toContain(svgIconClassName);
});

/** docs/specs/audit-a11y.md AC-1 */
test("has an accessible name", () => {
  const { getByRole } = render(<ToggleTheme />);

  expect(
    getByRole("button", { name: i18n.t("toggleThemeAction") })
  ).toBeInTheDocument();
});
