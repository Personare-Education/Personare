import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (beta activation, Spec Driven TDD):
 * src/components/beta-activation-section.tsx does not exist yet -- see
 * docs/specs/beta-activation.md AC-2..5, 7.
 */

vi.mock("@/actions/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/actions/beta", () => ({
  getBetaStatus: vi.fn(),
  redeemBetaCode: vi.fn(),
}));

const { getSession } = await import("@/actions/auth");
const { getBetaStatus, redeemBetaCode } = await import("@/actions/beta");
const { default: BetaActivationSection } = await import(
  "@/components/beta-activation-section"
);

const LOGIN_HINT_PATTERN = /entre com sua conta google/i;
const CODE_HINT_PATTERN = /PRSN-••••-••••-AB12/;
const INVALID_CODE_PATTERN = /não encontramos esse código/i;
const CODE_ALREADY_USED_PATTERN = /já foi usado por outra conta/i;
const ALREADY_ACTIVATED_PATTERN = /já tem o beta ativado/i;
const RATE_LIMITED_PATTERN = /espere um minuto/i;
const UNREACHABLE_PATTERN = /não foi possível falar com o servidor/i;

const SESSION = {
  avatarUrl: null,
  email: "aluno@example.com",
  id: "user-1",
  name: "Aluno",
};
const NOT_ACTIVATED = { activated: false, activatedAt: null, codeHint: null };
const ACTIVATED = {
  activated: true,
  activatedAt: "2026-09-27T12:00:00.000Z",
  codeHint: "PRSN-••••-••••-AB12",
};

describe("BetaActivationSection", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    vi.mocked(getSession).mockReset();
    vi.mocked(getBetaStatus).mockReset();
    vi.mocked(redeemBetaCode).mockReset();
  });

  it("asks to log in first, with no code field, when logged out", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    render(<BetaActivationSection />);

    expect(await screen.findByText(LOGIN_HINT_PATTERN)).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Código de ativação")
    ).not.toBeInTheDocument();
    expect(getBetaStatus).not.toHaveBeenCalled();
  });

  it("shows the code field with a disabled button until something is typed", async () => {
    vi.mocked(getSession).mockResolvedValue(SESSION);
    vi.mocked(getBetaStatus).mockResolvedValue(NOT_ACTIVATED);
    const user = userEvent.setup();

    render(<BetaActivationSection />);

    expect(await screen.findByText("Não ativado")).toBeInTheDocument();
    const input = screen.getByLabelText("Código de ativação");
    expect(input).toHaveAttribute("placeholder", "PRSN-XXXX-XXXX-XXXX");
    expect(screen.getByRole("button", { name: "Ativar" })).toBeDisabled();

    await user.type(input, "PRSN-AAAA-BBBB-AB12");
    expect(screen.getByRole("button", { name: "Ativar" })).toBeEnabled();
  });

  it("activates and swaps the form for the activated state", async () => {
    vi.mocked(getSession).mockResolvedValue(SESSION);
    vi.mocked(getBetaStatus).mockResolvedValue(NOT_ACTIVATED);
    vi.mocked(redeemBetaCode).mockResolvedValue(ACTIVATED);
    const user = userEvent.setup();

    render(<BetaActivationSection />);
    await user.type(
      await screen.findByLabelText("Código de ativação"),
      "prsn-aaaa-bbbb-ab12"
    );
    await user.click(screen.getByRole("button", { name: "Ativar" }));

    expect(redeemBetaCode).toHaveBeenCalledWith("prsn-aaaa-bbbb-ab12");
    expect(await screen.findByText("Beta ativado")).toBeInTheDocument();
    expect(screen.getByText(CODE_HINT_PATTERN)).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Código de ativação")
    ).not.toBeInTheDocument();
  });

  it.each([
    ["invalid_code", INVALID_CODE_PATTERN],
    ["code_already_used", CODE_ALREADY_USED_PATTERN],
    ["already_activated", ALREADY_ACTIVATED_PATTERN],
    ["rate_limited", RATE_LIMITED_PATTERN],
    ["unreachable", UNREACHABLE_PATTERN],
  ])(
    "shows an alert for %s and keeps the typed code",
    async (error, message) => {
      vi.mocked(getSession).mockResolvedValue(SESSION);
      vi.mocked(getBetaStatus).mockResolvedValue(NOT_ACTIVATED);
      vi.mocked(redeemBetaCode).mockResolvedValue({ error });
      const user = userEvent.setup();

      render(<BetaActivationSection />);
      const input = await screen.findByLabelText("Código de ativação");
      await user.type(input, "PRSN-AAAA-BBBB-CCCC");
      await user.click(screen.getByRole("button", { name: "Ativar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(input).toHaveValue("PRSN-AAAA-BBBB-CCCC");
    }
  );

  it("shows the activated state straight away for an account that already activated", async () => {
    vi.mocked(getSession).mockResolvedValue(SESSION);
    vi.mocked(getBetaStatus).mockResolvedValue(ACTIVATED);

    render(<BetaActivationSection />);

    expect(await screen.findByText("Beta ativado")).toBeInTheDocument();
    expect(screen.getByText(CODE_HINT_PATTERN)).toBeInTheDocument();
  });

  it("is translated to English", async () => {
    await i18n.changeLanguage("en");
    vi.mocked(getSession).mockResolvedValue(SESSION);
    vi.mocked(getBetaStatus).mockResolvedValue(NOT_ACTIVATED);

    render(<BetaActivationSection />);

    expect(await screen.findByText("Not activated")).toBeInTheDocument();
    expect(screen.getByLabelText("Activation code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activate" })
    ).toBeInTheDocument();
  });
});
