import { BACKEND_BASE_URL } from "@/constants";

export interface BackendUser {
  avatarUrl: string | null;
  email: string;
  id: string;
  name: string;
}

export async function fetchCurrentUser(
  token: string
): Promise<BackendUser | null> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as BackendUser;
  } catch {
    return null;
  }
}

export async function fetchCalendarAuthorizationUrl(
  token: string,
  redirectUri: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${BACKEND_BASE_URL}/calendar/connect?redirect_uri=${encodeURIComponent(redirectUri)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { authorizationUrl: string };
    return body.authorizationUrl;
  } catch {
    return null;
  }
}

export interface CalendarSyncReviewItem {
  dueDate: string;
  front: string;
  id: string;
}

export type CalendarSyncResult =
  | { created: number; deleted: number; updated: number }
  | { error: string };

export async function syncCalendarEvents(
  token: string,
  reviewItems: CalendarSyncReviewItem[]
): Promise<CalendarSyncResult> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/calendar/sync`, {
      body: JSON.stringify({ reviewItems }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = await response.json();

    return body as CalendarSyncResult;
  } catch {
    return { error: "unreachable" };
  }
}

export interface AccountExport {
  googleCalendarConnected: boolean;
  googleDriveConnected: boolean;
  profile: {
    avatarUrl: string | null;
    createdAt: string;
    email: string;
    id: string;
    name: string;
  };
}

export async function fetchAccountExport(
  token: string
): Promise<AccountExport | null> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AccountExport;
  } catch {
    return null;
  }
}

export async function deleteAccount(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      method: "DELETE",
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchDriveAuthorizationUrl(
  token: string,
  redirectUri: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${BACKEND_BASE_URL}/drive/connect?redirect_uri=${encodeURIComponent(redirectUri)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { authorizationUrl: string };
    return body.authorizationUrl;
  } catch {
    return null;
  }
}

export type DriveBackupUploadResult = { success: true } | { error: string };

export async function uploadDriveBackup(
  token: string,
  data: string
): Promise<DriveBackupUploadResult> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/drive/backup`, {
      body: JSON.stringify({ data }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (response.status === 204) {
      return { success: true };
    }

    const body = (await response.json()) as { error: string };
    return { error: body.error };
  } catch {
    return { error: "unreachable" };
  }
}

export type DriveBackupDownloadResult = { data: string } | { error: string };

export async function downloadDriveBackup(
  token: string
): Promise<DriveBackupDownloadResult> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/drive/backup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();

    return body as DriveBackupDownloadResult;
  } catch {
    return { error: "unreachable" };
  }
}

export interface BetaStatus {
  activated: boolean;
  activatedAt: string | null;
  codeHint: string | null;
}

export async function fetchBetaStatus(
  token: string
): Promise<BetaStatus | null> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/beta/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as BetaStatus;
  } catch {
    return null;
  }
}

export type BetaRedeemResult = BetaStatus | { error: string };

export async function redeemBetaCode(
  token: string,
  code: string
): Promise<BetaRedeemResult> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/beta/redeem`, {
      body: JSON.stringify({ code }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = await response.json();

    return body as BetaRedeemResult;
  } catch {
    return { error: "unreachable" };
  }
}

export type BetaAccessResult =
  | { kind: "ok"; status: BetaStatus }
  | { kind: "unauthorized" }
  | { kind: "unreachable" };

/**
 * Like fetchBetaStatus, but tells a rejected token (sign in again) apart
 * from a backend that can't be reached (the app's offline grace period).
 */
export async function checkBetaAccess(
  token: string
): Promise<BetaAccessResult> {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/beta/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      return { kind: "unauthorized" };
    }

    if (!response.ok) {
      return { kind: "unreachable" };
    }

    return { kind: "ok", status: (await response.json()) as BetaStatus };
  } catch {
    return { kind: "unreachable" };
  }
}
