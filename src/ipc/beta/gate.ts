import path from "node:path";
import {
  getAuthSession,
  getAuthToken,
  getAuthTokenFilePath,
  setAuthSession,
  setAuthToken,
} from "@/ipc/auth/state";
import { clearToken, loadToken } from "@/main/auth-token-storage";
import { checkBetaAccess, fetchCurrentUser } from "@/main/backend-client";
import {
  clearBetaStatusCache,
  readBetaStatusCache,
  writeBetaStatusCache,
} from "@/main/beta-status-cache";

export type BetaGateState =
  | { kind: "activated"; offline: boolean }
  | { kind: "not_activated" }
  | { kind: "offline" }
  | { kind: "signed_out" };

/** How long a past "activated" answer keeps the app open without internet. */
const OFFLINE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

export function getBetaStatusCachePath() {
  return path.join(path.dirname(getAuthTokenFilePath()), "beta-status.enc");
}

/** The JWT's subject (account id), read without verifying -- local use only. */
export function accountIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1] ?? "";
    const { sub } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    ) as { sub?: unknown };
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

export function rememberBetaStatus(token: string, activated: boolean) {
  const userId = accountIdFromToken(token);

  if (userId) {
    writeBetaStatusCache(getBetaStatusCachePath(), {
      activated,
      checkedAt: Date.now(),
      userId,
    });
  }
}

export function forgetBetaStatus() {
  clearBetaStatusCache(getBetaStatusCachePath());
}

/**
 * Playwright launches the build through the generic Electron binary
 * (process.defaultApp); an installed Personare never is, so CI=e2e alone
 * does not unlock it.
 */
function isE2eRun() {
  return process.env.CI === "e2e" && Boolean(process.defaultApp);
}

/**
 * Whether this app may open: a signed-in account with the closed beta
 * activated. Offline, the same account's last "activated" answer is
 * trusted for OFFLINE_GRACE_MS.
 */
export async function resolveBetaGate(): Promise<BetaGateState> {
  if (isE2eRun()) {
    return { kind: "activated", offline: false };
  }

  const tokenFilePath = getAuthTokenFilePath();
  const token = getAuthToken() ?? loadToken(tokenFilePath);

  if (!token) {
    return { kind: "signed_out" };
  }

  const access = await checkBetaAccess(token);

  if (access.kind === "unauthorized") {
    setAuthSession(null);
    setAuthToken(null);
    clearToken(tokenFilePath);
    forgetBetaStatus();
    return { kind: "signed_out" };
  }

  if (access.kind === "ok") {
    rememberBetaStatus(token, access.status.activated);

    if (!getAuthSession()) {
      const user = await fetchCurrentUser(token);
      if (user) {
        setAuthSession(user);
        setAuthToken(token);
      }
    }

    return access.status.activated
      ? { kind: "activated", offline: false }
      : { kind: "not_activated" };
  }

  const cached = readBetaStatusCache(getBetaStatusCachePath());
  const isTrusted =
    cached?.activated === true &&
    cached.userId === accountIdFromToken(token) &&
    Date.now() - cached.checkedAt <= OFFLINE_GRACE_MS;

  return isTrusted ? { kind: "activated", offline: true } : { kind: "offline" };
}
