import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { app, dialog, shell } from "electron";
import {
  type LinuxUpdate,
  linuxUpdateStrings,
  runLinuxUpdateCheck,
} from "@/main/linux-updater";

/** Every 4 hours after the check at launch (docs/specs/linux-updates.md AC-1). */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

async function download(url: string, file: string): Promise<void> {
  const response = await fetch(url);
  if (!(response.ok && response.body)) {
    throw new Error(`Download answered ${response.status}`);
  }
  await pipeline(
    Readable.fromWeb(response.body as WebReadableStream),
    createWriteStream(file)
  );
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

/**
 * Linux's own updater (update-electron-app has no Linux support): checks
 * the feed at launch and every 4 hours; the AppImage swaps itself and asks
 * to restart, .deb and .rpm get a download offer.
 */
export function startLinuxUpdates(options: { host: string; repo: string }) {
  if (!app.isPackaged) {
    return;
  }
  const strings = linuxUpdateStrings(app.getLocale());
  const offered = new Set<string>();

  const askRestart = async (update: LinuxUpdate) => {
    const { response } = await dialog.showMessageBox({
      buttons: [strings.restart, strings.later],
      cancelId: 1,
      defaultId: 0,
      detail: strings.restartDetail,
      message: strings.restartMessage(update.name),
      type: "info",
    });
    return response === 0;
  };

  const offerDownload = async (update: LinuxUpdate) => {
    const { response } = await dialog.showMessageBox({
      buttons: [strings.download, strings.notNow],
      cancelId: 1,
      defaultId: 0,
      detail: strings.offerDetail,
      message: strings.offerMessage(update.name),
      type: "info",
    });
    if (response === 0) {
      await shell.openExternal(update.url);
    }
  };

  const check = () =>
    runLinuxUpdateCheck({
      askRestart,
      chmod: fs.chmod,
      download,
      env: process.env,
      exists: existsSync,
      fetch,
      host: options.host,
      log: (message, error) => console.error(message, error),
      offerDownload,
      offered,
      relaunch: (appImagePath) => {
        app.relaunch({ execPath: appImagePath });
        app.exit(0);
      },
      rename: fs.rename,
      repo: options.repo,
      sha256File,
      unlink: fs.unlink,
      version: app.getVersion(),
    });

  check();
  setInterval(check, CHECK_INTERVAL_MS);
}
