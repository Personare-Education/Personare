import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

/**
 * RED phase (beta app gate, Spec Driven TDD): src/components/beta-gate.tsx
 * does not exist yet -- see docs/specs/beta-app-gate.md AC-7..14.
 */

vi.mock("@/actions/beta", () => ({
  getBetaGate: vi.fn(),
  getBetaStatus: vi.fn(),
  redeemBetaCode: vi.fn(),
}));
vi.mock("@/actions/auth", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@/actions/shell", () => ({
  openExternalLink: vi.fn(),
}));
vi.mock("@/actions/app", () => ({
  getPlatform: vi.fn().mockResolvedValue("win32"),
}));
vi.mock("@/actions/window", () => ({
  closeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  minimizeWindow: vi.fn(),
}));

const { getBetaGate, redeemBetaCode } = await import("@/actions/beta");
const { getSession, login, logout } = await import("@/actions/auth");
const { openExternalLink } = await import("@/actions/shell");
const { default: BetaGate } = await import("@/components/beta-gate");
const { notifySessionChanged } = await import("@/utils/session-events");

const SESSION = {
  avatarUrl: null,
  email: "aluno@example.com",
  id: "user-1",
  name: "Aluno",
};
const ACTIVATED = {
  activated: true,
  activatedAt: "2026-09-28T00:00:00.000Z",
  codeHint: "PRSN-••••-••••-AB12",
};
const SITE_ACTIVATE_URL_PATTERN = /\/ativar\/$/;
const SITE_BETA_URL_PATTERN = /\/beta\/$/;

function renderGate() {
  return render(
    <BetaGate>
      <p>conteúdo do app</p>
    </BetaGate>
  );
}

describe("BetaGate", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    vi.mocked(getBetaGate).mockReset();
    vi.mocked(redeemBetaCode).mockReset();
    vi.mocked(getSession).mockReset().mockResolvedValue(SESSION);
    vi.mocked(login).mockReset().mockResolvedValue(undefined);
    vi.mocked(logout).mockReset().mockResolvedValue(undefined);
    vi.mocked(openExternalLink).mockReset();
  });

  it("shows the app when the account has the beta", async () => {
    vi.mocked(getBetaGate).mockResolvedValue({ kind: "activated", offline: false });

    renderGate();

    expect(await screen.findByText("conteúdo do app")).toBeInTheDocument();
  });

  it("never shows the app while the decision is loading", () => {
    vi.mocked(getBetaGate).mockReturnValue(new Promise(() => undefined));

    renderGate();

    expect(screen.queryByText("conteúdo do app")).not.toBeInTheDocument();
  });

  it("asks to sign in, starts the login and opens once the account is activated", async () => {
    vi.mocked(getBetaGate)
      .mockResolvedValueOnce({ kind: "signed_out" })
      .mockResolvedValue({ kind: "activated", offline: false });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderGate();
    expect(
      await screen.findByRole("heading", { name: "Entre para usar o Personare" })
    ).toBeInTheDocument();
    expect(screen.queryByText("conteúdo do app")).not.toBeInTheDocument();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await user.click(screen.getByRole("button", { name: "Entrar com Google" }));
      expect(login).toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(await screen.findByText("conteúdo do app")).toBeInTheDocument();
  });

  it("asks for the code when signed in without beta, and opens after activating", async () => {
    vi.mocked(getBetaGate)
      .mockResolvedValueOnce({ kind: "not_activated" })
      .mockResolvedValue({ kind: "activated", offline: false });
    vi.mocked(redeemBetaCode).mockResolvedValue(ACTIVATED);
    const user = userEvent.setup();

    renderGate();

    expect(
      await screen.findByRole("heading", { name: "Ative seu beta" })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Conectado como aluno@example.com/)
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Código de ativação"),
      "PRSN-AAAA-BBBB-AB12"
    );
    await user.click(screen.getByRole("button", { name: "Ativar" }));

    expect(redeemBetaCode).toHaveBeenCalledWith("PRSN-AAAA-BBBB-AB12");
    expect(await screen.findByText("conteúdo do app")).toBeInTheDocument();
  });

  it("links to the site's activation and application pages", async () => {
    vi.mocked(getBetaGate).mockResolvedValue({ kind: "not_activated" });
    const user = userEvent.setup();

    renderGate();

    await user.click(
      await screen.findByRole("button", { name: "Ativar pelo site" })
    );
    expect(vi.mocked(openExternalLink).mock.calls[0]?.[0]).toMatch(
      SITE_ACTIVATE_URL_PATTERN
    );

    await user.click(
      screen.getByRole("button", { name: "Candidate-se ao beta" })
    );
    expect(vi.mocked(openExternalLink).mock.calls[1]?.[0]).toMatch(
      SITE_BETA_URL_PATTERN
    );
  });

  it("lets the user switch account", async () => {
    vi.mocked(getBetaGate)
      .mockResolvedValueOnce({ kind: "not_activated" })
      .mockResolvedValue({ kind: "signed_out" });
    const user = userEvent.setup();

    renderGate();
    await user.click(
      await screen.findByRole("button", { name: "Usar outra conta" })
    );

    expect(logout).toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", { name: "Entre para usar o Personare" })
    ).toBeInTheDocument();
  });

  it("explains being offline and retries", async () => {
    vi.mocked(getBetaGate)
      .mockResolvedValueOnce({ kind: "offline" })
      .mockResolvedValue({ kind: "activated", offline: false });
    const user = userEvent.setup();

    renderGate();
    expect(
      await screen.findByRole("heading", { name: "Sem conexão" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("conteúdo do app")).toBeInTheDocument();
  });

  it("locks again when the session changes (logout in Settings)", async () => {
    vi.mocked(getBetaGate)
      .mockResolvedValueOnce({ kind: "activated", offline: false })
      .mockResolvedValue({ kind: "signed_out" });

    renderGate();
    expect(await screen.findByText("conteúdo do app")).toBeInTheDocument();

    act(() => {
      notifySessionChanged();
    });

    expect(
      await screen.findByRole("heading", { name: "Entre para usar o Personare" })
    ).toBeInTheDocument();
    expect(screen.queryByText("conteúdo do app")).not.toBeInTheDocument();
  });

  it("is translated to English", async () => {
    await i18n.changeLanguage("en");
    vi.mocked(getBetaGate).mockResolvedValue({ kind: "not_activated" });

    renderGate();

    expect(
      await screen.findByRole("heading", { name: "Activate your beta" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activate on the website" })
    ).toBeInTheDocument();
  });
});
