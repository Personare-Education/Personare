import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, describe, expect, it } from "vitest";
import "@/localization/i18n";
import {
  applySavedTextSize,
  getTextSize,
  setTextSize,
} from "@/actions/text-size";
import TextSizeToggle from "@/components/text-size-toggle";

/**
 * docs/specs/text-size.md: the whole app's text, from the root font size,
 * saved on the computer like the theme.
 */

afterEach(() => {
  localStorage.clear();
  document.documentElement.style.fontSize = "";
});

describe("text size", () => {
  it("is the default when nothing was chosen", () => {
    expect(getTextSize()).toBe("default");
  });

  it("scales the root font size and remembers the choice", () => {
    setTextSize("large");

    expect(document.documentElement.style.fontSize).toBe("112.5%");
    expect(getTextSize()).toBe("large");
  });

  it("applies the saved size when the app opens", () => {
    setTextSize("larger");
    document.documentElement.style.fontSize = "";

    applySavedTextSize();

    expect(document.documentElement.style.fontSize).toBe("125%");
  });

  it("ignores a saved value it does not know", () => {
    localStorage.setItem("textSize", "huge");

    applySavedTextSize();

    expect(getTextSize()).toBe("default");
    expect(document.documentElement.style.fontSize).toBe("100%");
  });
});

describe("TextSizeToggle", () => {
  it("offers the four sizes with the current one pressed", () => {
    render(<TextSizeToggle />);

    for (const key of [
      "textSizeSmall",
      "textSizeDefault",
      "textSizeLarge",
      "textSizeLarger",
    ]) {
      expect(
        screen.getByRole("radio", { name: i18n.t(key) })
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("radio", { name: i18n.t("textSizeDefault") })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("changes the app's text size when a size is picked", async () => {
    const user = userEvent.setup();
    render(<TextSizeToggle />);

    await user.click(
      screen.getByRole("radio", { name: i18n.t("textSizeLarger") })
    );

    expect(document.documentElement.style.fontSize).toBe("125%");
    expect(
      screen.getByRole("radio", { name: i18n.t("textSizeLarger") })
    ).toHaveAttribute("aria-checked", "true");
  });
});
