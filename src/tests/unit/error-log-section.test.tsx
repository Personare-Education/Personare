import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/** docs/specs/error-log.md AC-5. */

vi.mock("@/actions/dialog", () => ({
  selectErrorLogExportPath: vi.fn(),
}));

vi.mock("@/actions/error-log", () => ({
  exportErrorLog: vi.fn(),
}));

const { selectErrorLogExportPath } = await import("@/actions/dialog");
const { exportErrorLog } = await import("@/actions/error-log");
const { default: ErrorLogSection } = await import(
  "@/components/error-log-section"
);

beforeEach(() => {
  vi.clearAllMocks();
});

async function clickExport() {
  render(<ErrorLogSection />);
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("exportErrorLogAction") })
  );
}

describe("ErrorLogSection", () => {
  it("says the log stays on this computer", () => {
    render(<ErrorLogSection />);

    expect(
      screen.getByRole("heading", { name: i18n.t("diagnosticsSectionTitle") })
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t("diagnosticsSectionDescription"))
    ).toBeTruthy();
  });

  it("exports to the chosen file", async () => {
    vi.mocked(selectErrorLogExportPath).mockResolvedValue("/tmp/errors.txt");
    vi.mocked(exportErrorLog).mockResolvedValue({ exported: true });

    await clickExport();

    expect(exportErrorLog).toHaveBeenCalledWith("/tmp/errors.txt");
    expect(
      await screen.findByText(i18n.t("errorLogExportedMessage"))
    ).toBeTruthy();
  });

  it("says when there is nothing to export", async () => {
    vi.mocked(selectErrorLogExportPath).mockResolvedValue("/tmp/errors.txt");
    vi.mocked(exportErrorLog).mockResolvedValue({ exported: false });

    await clickExport();

    expect(
      await screen.findByText(i18n.t("errorLogEmptyMessage"))
    ).toBeTruthy();
  });

  it("does nothing when the save dialog is canceled", async () => {
    vi.mocked(selectErrorLogExportPath).mockResolvedValue(null);

    await clickExport();

    expect(exportErrorLog).not.toHaveBeenCalled();
  });

  it("says when the export fails", async () => {
    vi.mocked(selectErrorLogExportPath).mockResolvedValue("/tmp/errors.txt");
    vi.mocked(exportErrorLog).mockRejectedValue(new Error("EACCES"));

    await clickExport();

    expect(
      await screen.findByText(i18n.t("errorLogExportErrorMessage"))
    ).toBeTruthy();
  });
});
