import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/** docs/specs/desired-retention.md AC-4. */

vi.mock("@/actions/settings", () => ({
  getSettings: vi.fn(),
  setDesiredRetention: vi.fn(),
}));

const { getSettings, setDesiredRetention } = await import("@/actions/settings");
const { default: DesiredRetentionToggle } = await import(
  "@/components/desired-retention-toggle"
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettings).mockResolvedValue({
    autoStartEnabled: false,
    desiredRetention: 0.85,
    soundsEnabled: true,
    testPrereleases: true,
  });
});

describe("DesiredRetentionToggle", () => {
  it("offers 80% to 95%, with the saved one pressed", async () => {
    render(<DesiredRetentionToggle />);

    for (const label of ["80%", "85%", "90%", "95%"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    await waitFor(() =>
      expect(screen.getByText("85%").closest("button")).toHaveAttribute(
        "data-state",
        "on"
      )
    );
    expect(
      screen.getByText(i18n.t("desiredRetentionDescription"))
    ).toBeInTheDocument();
  });

  it("names what the ends and the default mean", () => {
    render(<DesiredRetentionToggle />);

    expect(
      screen.getByRole("radio", {
        name: `95%, ${i18n.t("desiredRetentionExamHint")}`,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", {
        name: `90%, ${i18n.t("desiredRetentionRecommendedHint")}`,
      })
    ).toBeInTheDocument();
  });

  it("saves the one picked", async () => {
    const user = userEvent.setup();
    render(<DesiredRetentionToggle />);

    await user.click(screen.getByText("95%"));

    expect(setDesiredRetention).toHaveBeenCalledWith(0.95);
  });
});
