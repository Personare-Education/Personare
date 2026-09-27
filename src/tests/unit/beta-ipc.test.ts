import fs from "node:fs";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (beta activation, Spec Driven TDD): fetchBetaStatus /
 * redeemBetaCode in src/main/backend-client.ts and the "beta" oRPC
 * namespace do not exist yet -- see docs/specs/beta-activation.md AC-4..6.
 */

describe("beta backend client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchBetaStatus GETs /beta/status with the Bearer token", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          activated: true,
          activatedAt: "2026-09-27T12:00:00.000Z",
          codeHint: "PRSN-••••-••••-AB12",
        }),
        { status: 200 }
      )
    );
    const { fetchBetaStatus } = await import("@/main/backend-client");

    const status = await fetchBetaStatus("the-jwt-token");

    expect(status).toEqual({
      activated: true,
      activatedAt: "2026-09-27T12:00:00.000Z",
      codeHint: "PRSN-••••-••••-AB12",
    });
    const [requestUrl, options] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(requestUrl).toContain("/beta/status");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer the-jwt-token",
    });
  });

  it("fetchBetaStatus returns null on a rejected token or network failure", async () => {
    const { fetchBetaStatus } = await import("@/main/backend-client");

    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(fetchBetaStatus("expired")).resolves.toBeNull();

    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    await expect(fetchBetaStatus("any")).resolves.toBeNull();
  });

  it("redeemBetaCode POSTs the code and returns the new status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          activated: true,
          activatedAt: "2026-09-27T12:00:00.000Z",
          codeHint: "PRSN-••••-••••-AB12",
        }),
        { status: 200 }
      )
    );
    const { redeemBetaCode } = await import("@/main/backend-client");

    const result = await redeemBetaCode("the-jwt-token", "PRSN-AAAA-BBBB-AB12");

    expect(result).toMatchObject({ activated: true });
    const [requestUrl, options] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(requestUrl).toContain("/beta/redeem");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ code: "PRSN-AAAA-BBBB-AB12" }));
  });

  it("redeemBetaCode returns the backend's error (404/409/429) or unreachable", async () => {
    const { redeemBetaCode } = await import("@/main/backend-client");

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "code_already_used" }), {
        status: 409,
      })
    );
    await expect(redeemBetaCode("t", "x")).resolves.toEqual({
      error: "code_already_used",
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 })
    );
    await expect(redeemBetaCode("t", "x")).resolves.toEqual({
      error: "rate_limited",
    });

    vi.mocked(fetch).mockRejectedValue(new Error("network error"));
    await expect(redeemBetaCode("t", "x")).resolves.toEqual({
      error: "unreachable",
    });
  });
});

describe("beta IPC namespace", () => {
  async function loadClient() {
    const { beta } = await import("@/ipc/beta");
    return createRouterClient(beta);
  }

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { setAuthToken } = await import("@/ipc/auth/state");
    setAuthToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(/\bbeta\b/);
  });

  it("getStatus is null when logged out, without calling the backend", async () => {
    const client = await loadClient();

    await expect(client.getStatus()).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("redeem answers not_logged_in when logged out", async () => {
    const client = await loadClient();

    await expect(client.redeem({ code: "PRSN-AAAA-BBBB-CCCC" })).resolves.toEqual(
      { error: "not_logged_in" }
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the stored JWT when logged in", async () => {
    const { setAuthToken } = await import("@/ipc/auth/state");
    setAuthToken("the-jwt-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ activated: false, activatedAt: null, codeHint: null }),
        { status: 200 }
      )
    );
    const client = await loadClient();

    await expect(client.getStatus()).resolves.toEqual({
      activated: false,
      activatedAt: null,
      codeHint: null,
    });
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({
      Authorization: "Bearer the-jwt-token",
    });
  });
});
