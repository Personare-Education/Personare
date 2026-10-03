import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

vi.mock("@/actions/language", () => ({
  setAppLanguage: vi.fn(),
}));

const { default: LangToggle } = await import("@/components/lang-toggle");

/**
 * docs/specs/rating-clarity.md AC-4: the languages read by their own names,
 * not as locale codes.
 */
describe("LangToggle", () => {
  it("names each language in its own words", () => {
    render(<LangToggle />);

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Português")).toBeInTheDocument();
    expect(screen.queryByText("PT-BR")).not.toBeInTheDocument();
  });
});
