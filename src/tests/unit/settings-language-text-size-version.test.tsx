import { render, screen, waitFor } from "@testing-library/react";
import { ar, de, es, fr, ja, ko, zhCN } from "date-fns/locale";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (docs/specs/settings-language-text-size-version.md): Arabic
 * reads right to left, dates follow the language, the text sizes read S, M,
 * L, XL, and Settings shows the app's version at the bottom.
 */

vi.mock("@/actions/app", () => ({
  getAppVersion: vi.fn().mockResolvedValue("0.1.0-alpha.11"),
}));
vi.mock("@/actions/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({ autoStartEnabled: false }),
  setAutoStart: vi.fn(),
}));
vi.mock("@/actions/dialog", () => ({ selectBackupImportFile: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

const { setAppLanguage, updateAppLanguage } = await import(
  "@/actions/language"
);
const { resolveEventCalendarLocale } = await import(
  "@/utils/event-calendar-i18n"
);
const { default: TextSizeToggle } = await import(
  "@/components/text-size-toggle"
);
const { default: SettingsDialog } = await import(
  "@/components/settings-dialog"
);
const { default: AppDirection } = await import("@/components/app-direction");
const { useDirection } = await import("@/components/ui/direction");

afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("en");
  document.documentElement.dir = "";
  document.documentElement.lang = "";
});

function DirectionProbe() {
  return <p>{useDirection()}</p>;
}

describe("Arabic reads right to left (AC-5)", () => {
  it("turns the document right to left with Arabic, and back", async () => {
    setAppLanguage("ar", i18n);
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(document.documentElement.lang).toBe("ar");

    setAppLanguage("de", i18n);
    await waitFor(() => expect(document.documentElement.dir).toBe("ltr"));
  });

  it("opens right to left when Arabic was saved", async () => {
    localStorage.setItem("lang", "ar");

    updateAppLanguage(i18n);

    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
  });

  it("gives the components the language's direction", async () => {
    render(
      <AppDirection>
        <DirectionProbe />
      </AppDirection>
    );
    expect(screen.getByText("ltr")).toBeInTheDocument();

    await i18n.changeLanguage("ar");

    expect(await screen.findByText("rtl")).toBeInTheDocument();
  });
});

describe("dates in the language (AC-6)", () => {
  it.each([
    ["es", es],
    ["zh-CN", zhCN],
    ["ar", ar],
    ["fr", fr],
    ["de", de],
    ["ja", ja],
    ["ko", ko],
  ])("uses date-fns's locale for %s", (lang, locale) => {
    expect(resolveEventCalendarLocale(lang)).toBe(locale);
  });
});

describe("text sizes as S, M, L, XL (AC-7)", () => {
  it("shows S, M, L, XL, read aloud by their full names", () => {
    render(<TextSizeToggle />);

    for (const [short, key] of [
      ["S", "textSizeSmall"],
      ["M", "textSizeDefault"],
      ["L", "textSizeLarge"],
      ["XL", "textSizeLarger"],
    ]) {
      expect(
        screen.getByRole("radio", { name: i18n.t(key) })
      ).toHaveTextContent(new RegExp(`^${short}$`));
    }
  });
});

describe("Settings → General (AC-2, AC-8)", () => {
  it("marks the language heading with the language icon", () => {
    render(<SettingsDialog onOpenChange={vi.fn()} open />);

    const heading = screen.getByRole("heading", {
      name: i18n.t("languageLabel"),
    });
    expect(heading.querySelector("svg.lucide-languages")).toBeInTheDocument();
  });

  it("shows the app's version at the bottom", async () => {
    render(<SettingsDialog onOpenChange={vi.fn()} open />);

    expect(
      await screen.findByText(
        i18n.t("settingsVersionLabel", { version: "0.1.0-alpha.11" })
      )
    ).toBeInTheDocument();
  });
});
