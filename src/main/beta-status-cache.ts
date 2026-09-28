import fs from "node:fs";
import { safeStorage } from "electron";

/**
 * The last beta check the backend answered, for the offline grace period
 * (src/ipc/beta/gate.ts). Encrypted with safeStorage like the auth token,
 * so it can't simply be edited to unlock the app.
 */
export interface BetaStatusCacheEntry {
  activated: boolean;
  checkedAt: number;
  userId: string;
}

export function writeBetaStatusCache(
  filePath: string,
  entry: BetaStatusCacheEntry
): void {
  if (!safeStorage.isEncryptionAvailable()) {
    return;
  }

  fs.writeFileSync(filePath, safeStorage.encryptString(JSON.stringify(entry)));
}

export function readBetaStatusCache(
  filePath: string
): BetaStatusCacheEntry | null {
  if (!(safeStorage.isEncryptionAvailable() && fs.existsSync(filePath))) {
    return null;
  }

  try {
    return JSON.parse(
      safeStorage.decryptString(fs.readFileSync(filePath))
    ) as BetaStatusCacheEntry;
  } catch {
    return null;
  }
}

export function clearBetaStatusCache(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
