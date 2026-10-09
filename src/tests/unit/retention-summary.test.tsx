import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/** docs/specs/retention-summary.md AC-3. */

vi.mock("@/actions/stats", () => ({ getRetentionStats: vi.fn() }));

const { getRetentionStats } = await import("@/actions/stats");
const { default: RetentionSummary } = await import(
  "@/components/retention-summary"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RetentionSummary", () => {
  it("shows what was remembered next to the target", async () => {
    vi.mocked(getRetentionStats).mockResolvedValue({
      attempts: 40,
      desiredRetention: 0.9,
      remembered: 35,
    });

    render(<RetentionSummary />);

    expect(await screen.findByText("88%")).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("retentionSummaryRemembered", { count: 40 }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("retentionSummaryTarget", { target: 90 }))
    ).toBeInTheDocument();
  });

  it("stays hidden with too few reviews to mean anything", async () => {
    vi.mocked(getRetentionStats).mockResolvedValue({
      attempts: 19,
      desiredRetention: 0.9,
      remembered: 19,
    });

    const { container } = render(<RetentionSummary />);

    await vi.waitFor(() => expect(getRetentionStats).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when the numbers can't be loaded", async () => {
    vi.mocked(getRetentionStats).mockRejectedValue(new Error("db"));

    const { container } = render(<RetentionSummary />);

    await vi.waitFor(() => expect(getRetentionStats).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
