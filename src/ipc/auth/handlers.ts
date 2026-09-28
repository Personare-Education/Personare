import fs from "node:fs";
import { os } from "@orpc/server";
import { shell } from "electron";
import { z } from "zod";
import { BACKEND_BASE_URL, OAUTH_REDIRECT_URI } from "@/constants";
import { forgetBetaStatus } from "@/ipc/beta/gate";
import { setCalendarConnected } from "@/ipc/calendar-sync/state";
import { setDriveConnected } from "@/ipc/drive-backup/state";
import { clearToken } from "@/main/auth-token-storage";
import {
  deleteAccount as deleteAccountOnBackend,
  fetchAccountExport,
} from "@/main/backend-client";
import {
  getAuthSession,
  getAuthToken,
  getAuthTokenFilePath,
  setAuthSession,
  setAuthToken,
} from "./state";

export const login = os.handler(async () => {
  const url = `${BACKEND_BASE_URL}/auth/google?redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}`;

  await shell.openExternal(url);
});

export const getSession = os.handler(() => getAuthSession());

function clearLocalSession() {
  setAuthSession(null);
  setAuthToken(null);
  setCalendarConnected(false);
  setDriveConnected(false);
  clearToken(getAuthTokenFilePath());
  forgetBetaStatus();
}

export const logout = os.handler(() => {
  clearLocalSession();
});

export const exportAccountData = os
  .input(z.object({ filePath: z.string() }))
  .handler(async ({ input }) => {
    const token = getAuthToken();

    if (!token) {
      return false;
    }

    const data = await fetchAccountExport(token);

    if (!data) {
      return false;
    }

    fs.writeFileSync(input.filePath, JSON.stringify(data, null, 2));
    return true;
  });

export const deleteAccount = os.handler(async () => {
  const token = getAuthToken();

  if (!token) {
    return false;
  }

  const deleted = await deleteAccountOnBackend(token);

  if (deleted) {
    clearLocalSession();
  }

  return deleted;
});
