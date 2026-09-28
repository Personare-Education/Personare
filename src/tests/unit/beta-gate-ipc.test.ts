import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (beta app gate, Spec Driven TDD): beta.getGate, the beta
 * status cache and checkBetaAccess do not exist yet -- see
 * docs/specs/beta-app-gate.md AC-1..6.
 */

vi.mock("electron", () => ({
  safeStorage: {
    decryptString: (buffer: Buffer) => buffer.toString("utf-8").slice(4),
    encryptString: (value: string) => Buffer.from(`enc:${value}`, "utf-8"),
    isEncryptionAvailable: () => true,
  },
  shell: { openExternal: vi.fn() },
}));

vi.mock("@/main/backend-client", () => ({
  checkBetaAccess: vi.fn(),
  deleteAccount: vi.fn(),
  fetchAccountExport: vi.fn(),
  fetchBetaStatus: vi.fn(),
  fetchCurrentUser: vi.fn(),
  redeemBetaCode: vi.fn(),
}));

const { checkBetaAccess, fetchCurrentUser, redeemBetaCode } = await import(
  "@/main/backend-client"
);
const authState = await import("@/ipc/auth/state");
const { saveToken, loadToken } = await import("@/main/auth-token-storage");

const USER = {
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
const NOT_ACTIVATED = { activated: false, activatedAt: null, codeHint: null };
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function jwtFor(sub: string) {
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
}

describe("beta.getGate", () => {
  let tmpDir: string;
  let tokenFile: string;
  let client: ReturnType<typeof createRouterClient<Awaited<typeof import("@/ipc/beta")>["beta"]>>;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-beta-gate-"));
    tokenFile = path.join(tmpDir, "auth-token.enc");
    authState.setAuthTokenFilePath(tokenFile);
    authState.setAuthToken(null);
    authState.setAuthSession(null);
    vi.mocked(checkBetaAccess).mockReset();
    vi.mocked(fetchCurrentUser).mockReset().mockResolvedValue(USER);
    vi.mocked(redeemBetaCode).mockReset();
    const { beta } = await import("@/ipc/beta");
    client = createRouterClient(beta);
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function signIn(sub = "user-1") {
    const token = jwtFor(sub);
    saveToken(tokenFile, token);
    authState.setAuthToken(token);
    authState.setAuthSession({ ...USER, id: sub });
    return token;
  }

  it("is signed_out without a saved token, without calling the backend", async () => {
    await expect(client.getGate()).resolves.toEqual({ kind: "signed_out" });
    expect(checkBetaAccess).not.toHaveBeenCalled();
  });

  it("is activated when the backend confirms the beta", async () => {
    const token = signIn();
    vi.mocked(checkBetaAccess).mockResolvedValue({
      kind: "ok",
      status: ACTIVATED,
    });

    await expect(client.getGate()).resolves.toEqual({
      kind: "activated",
      offline: false,
    });
    expect(checkBetaAccess).toHaveBeenCalledWith(token);
  });

  it("is not_activated when the account has no beta", async () => {
    signIn();
    vi.mocked(checkBetaAccess).mockResolvedValue({
      kind: "ok",
      status: NOT_ACTIVATED,
    });

    await expect(client.getGate()).resolves.toEqual({ kind: "not_activated" });
  });

  it("restores the session when the app started offline and the backend is back", async () => {
    const token = jwtFor("user-1");
    saveToken(tokenFile, token);
    vi.mocked(checkBetaAccess).mockResolvedValue({
      kind: "ok",
      status: ACTIVATED,
    });

    await client.getGate();

    expect(authState.getAuthToken()).toBe(token);
    expect(authState.getAuthSession()).toEqual(USER);
  });

  it("signs out locally when the token is rejected (401)", async () => {
    signIn();
    vi.mocked(checkBetaAccess).mockResolvedValue({ kind: "unauthorized" });

    await expect(client.getGate()).resolves.toEqual({ kind: "signed_out" });
    expect(authState.getAuthToken()).toBeNull();
    expect(authState.getAuthSession()).toBeNull();
    expect(loadToken(tokenFile)).toBeNull();
  });

  describe("offline", () => {
    async function checkOnlineAs(status: typeof ACTIVATED | typeof NOT_ACTIVATED) {
      vi.mocked(checkBetaAccess).mockResolvedValueOnce({ kind: "ok", status });
      await client.getGate();
      vi.mocked(checkBetaAccess).mockResolvedValue({ kind: "unreachable" });
    }

    it("allows the same account that was last seen activated, marked offline", async () => {
      signIn("user-1");
      await checkOnlineAs(ACTIVATED);

      await expect(client.getGate()).resolves.toEqual({
        kind: "activated",
        offline: true,
      });
    });

    it("works after a restart: token only on disk, no session in memory", async () => {
      signIn("user-1");
      await checkOnlineAs(ACTIVATED);
      authState.setAuthToken(null);
      authState.setAuthSession(null);

      await expect(client.getGate()).resolves.toEqual({
        kind: "activated",
        offline: true,
      });
    });

    it("is offline when nothing was ever confirmed", async () => {
      signIn();
      vi.mocked(checkBetaAccess).mockResolvedValue({ kind: "unreachable" });

      await expect(client.getGate()).resolves.toEqual({ kind: "offline" });
    });

    it("is offline when the last confirmation said not activated", async () => {
      signIn();
      await checkOnlineAs(NOT_ACTIVATED);

      await expect(client.getGate()).resolves.toEqual({ kind: "offline" });
    });

    it("does not reuse another account's confirmation", async () => {
      signIn("user-1");
      await checkOnlineAs(ACTIVATED);
      signIn("user-2");

      await expect(client.getGate()).resolves.toEqual({ kind: "offline" });
    });

    it("stops trusting the confirmation after 14 days", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      signIn();
      await checkOnlineAs(ACTIVATED);

      vi.setSystemTime(Date.now() + FOURTEEN_DAYS_MS + 1000);

      await expect(client.getGate()).resolves.toEqual({ kind: "offline" });
    });

    it("forgets the confirmation on logout", async () => {
      signIn();
      await checkOnlineAs(ACTIVATED);
      const { auth } = await import("@/ipc/auth");
      await createRouterClient(auth).logout();
      signIn();

      await expect(client.getGate()).resolves.toEqual({ kind: "offline" });
    });

    it("counts a successful code redemption as a confirmation", async () => {
      signIn();
      vi.mocked(redeemBetaCode).mockResolvedValue(ACTIVATED);
      await client.redeem({ code: "PRSN-AAAA-BBBB-AB12" });
      vi.mocked(checkBetaAccess).mockResolvedValue({ kind: "unreachable" });

      await expect(client.getGate()).resolves.toEqual({
        kind: "activated",
        offline: true,
      });
    });
  });

  describe("e2e bypass", () => {
    const originalCi = process.env.CI;
    const originalDefaultApp = (process as { defaultApp?: boolean }).defaultApp;

    afterEach(() => {
      process.env.CI = originalCi;
      (process as { defaultApp?: boolean }).defaultApp = originalDefaultApp;
    });

    it("opens for Playwright's generic Electron binary with CI=e2e", async () => {
      process.env.CI = "e2e";
      (process as { defaultApp?: boolean }).defaultApp = true;

      await expect(client.getGate()).resolves.toEqual({
        kind: "activated",
        offline: false,
      });
      expect(checkBetaAccess).not.toHaveBeenCalled();
    });

    it("never opens the installed app just because CI=e2e is set", async () => {
      process.env.CI = "e2e";
      (process as { defaultApp?: boolean }).defaultApp = undefined;

      await expect(client.getGate()).resolves.toEqual({ kind: "signed_out" });
    });
  });
});

describe("checkBetaAccess", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tells ok, unauthorized and unreachable apart", async () => {
    const { checkBetaAccess: realCheck } = await vi.importActual<
      typeof import("@/main/backend-client")
    >("@/main/backend-client");

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(ACTIVATED), { status: 200 })
    );
    await expect(realCheck("t")).resolves.toEqual({
      kind: "ok",
      status: ACTIVATED,
    });

    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(realCheck("t")).resolves.toEqual({ kind: "unauthorized" });

    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 502 }));
    await expect(realCheck("t")).resolves.toEqual({ kind: "unreachable" });

    vi.mocked(fetch).mockRejectedValue(new TypeError("offline"));
    await expect(realCheck("t")).resolves.toEqual({ kind: "unreachable" });
  });
});
