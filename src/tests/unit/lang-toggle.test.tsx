import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

vi.mock("@/actions/language", () => ({
  setAppLanguage: vi.fn(),
}));

const { setAppLanguage } = await import("@/actions/language");
const { default: LangToggle } = await import("@/components/lang-toggle");
const { Dialog, DialogContent, DialogTitle } = await import(
  "@/components/ui/dialog"
);

afterEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
});

/**
 * docs/specs/rating-clarity.md AC-4: the languages read by their own names,
 * not as locale codes. docs/specs/settings-language-text-size-version.md
 * AC-1, AC-3: a combobox, the chosen language with its flag, the list
 * filtered by name.
 */
describe("LangToggle", () => {
  it("shows the chosen language with its flag", () => {
    render(<LangToggle />);

    const trigger = screen.getByRole("combobox", {
      name: i18n.t("languageLabel"),
    });
    expect(trigger).toHaveTextContent("English");
    expect(within(trigger).getByTestId("flag-US")).toBeInTheDocument();
  });

  it("names each language in its own words, each with its flag", async () => {
    const user = userEvent.setup();
    render(<LangToggle />);

    await user.click(
      screen.getByRole("combobox", { name: i18n.t("languageLabel") })
    );

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "English",
      "Português",
      "Español",
      "简体中文",
      "العربية",
      "Français",
      "Deutsch",
      "日本語",
      "한국어",
    ]);
    expect(
      within(screen.getByRole("option", { name: "日本語" })).getByTestId(
        "flag-JP"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("PT-BR")).not.toBeInTheDocument();
  });

  it("filters by name and switches the language", async () => {
    const user = userEvent.setup();
    render(<LangToggle />);

    await user.click(
      screen.getByRole("combobox", { name: i18n.t("languageLabel") })
    );
    await user.type(
      await screen.findByPlaceholderText(i18n.t("languageSearchPlaceholder")),
      "fran"
    );
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    await user.click(options[0]);

    expect(setAppLanguage).toHaveBeenCalledWith("fr", i18n);
  });

  it("opens its list inside a dialog, where the dialog lets it be clicked", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <LangToggle />
        </DialogContent>
      </Dialog>
    );

    await user.click(
      screen.getByRole("combobox", { name: i18n.t("languageLabel") })
    );

    const option = await screen.findByRole("option", { name: "Deutsch" });
    expect(option.closest('[data-slot="dialog-content"]')).not.toBeNull();
    await user.click(option);
    expect(setAppLanguage).toHaveBeenCalledWith("de", i18n);
  });
});
