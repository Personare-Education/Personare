import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/** RED phase (docs/specs/gamification.md §2 AC-3): Settings → Sounds. */

vi.mock("@/actions/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({ soundsEnabled: true }),
  setSoundsEnabled: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/utils/sounds", () => ({ setSoundsEnabled: vi.fn() }));

const actions = await import("@/actions/settings");
const sounds = await import("@/utils/sounds");
const { default: SoundsToggle } = await import("@/components/sounds-toggle");

describe("SoundsToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is on by default, and turning it off saves it and silences the app at once", async () => {
    const user = userEvent.setup();
    render(<SoundsToggle />);
    const toggle = screen.getByRole("switch", {
      name: i18n.t("soundsToggleLabel"),
    });
    await waitFor(() => expect(toggle).toBeChecked());

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(actions.setSoundsEnabled).toHaveBeenCalledWith(false);
    expect(sounds.setSoundsEnabled).toHaveBeenCalledWith(false);
  });
});
