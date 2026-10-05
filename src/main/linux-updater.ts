import path from "node:path";

/** How the app was installed on Linux (docs/specs/linux-updates.md AC-1). */
export type LinuxFormat = "appimage" | "deb" | "rpm";

/** What the update feed answers with when there is a newer version. */
export interface LinuxUpdate {
  name: string;
  sha256: string | null;
  size: number;
  url: string;
}

/**
 * An AppImage sets APPIMAGE; otherwise a Debian-family system means the
 * .deb, and anything else the .rpm.
 */
export function linuxFormat(
  env: Record<string, string | undefined>,
  exists: (file: string) => boolean
): LinuxFormat {
  if (env.APPIMAGE) {
    return "appimage";
  }
  return exists("/etc/debian_version") ? "deb" : "rpm";
}

/** The feed address for this format and version, on the channel's host. */
export function linuxFeedUrl(
  host: string,
  repo: string,
  format: LinuxFormat,
  version: string
): string {
  return `${host}/${repo}/linux-x64-${format}/${version}`;
}

/** A newer version from the feed, or null (204) when this one is current. */
export async function checkLinuxUpdate(
  url: string,
  fetchImpl: typeof fetch
): Promise<LinuxUpdate | null> {
  const response = await fetchImpl(url);
  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Update feed answered ${response.status}`);
  }
  return (await response.json()) as LinuxUpdate;
}

interface InstallDeps {
  chmod: (file: string, mode: number) => Promise<unknown>;
  download: (url: string, file: string) => Promise<unknown>;
  rename: (from: string, to: string) => Promise<unknown>;
  sha256File: (file: string) => Promise<string>;
  unlink: (file: string) => Promise<unknown>;
}

/**
 * Swaps the AppImage for the new version (AC-2): downloaded beside it (same
 * file system, so the swap is one rename), checked against the published
 * SHA-256 -- a mismatch is thrown away -- and made executable. The running
 * app keeps its mounted copy until it restarts.
 */
export async function installAppImage(
  appImagePath: string,
  update: LinuxUpdate,
  deps: InstallDeps
): Promise<void> {
  const temp = path.posix.join(
    path.posix.dirname(appImagePath),
    `.${path.posix.basename(appImagePath)}.update`
  );
  await deps.download(update.url, temp);
  if (update.sha256) {
    const actual = await deps.sha256File(temp);
    if (actual.toLowerCase() !== update.sha256.toLowerCase()) {
      await deps.unlink(temp).catch(() => undefined);
      throw new Error("The downloaded AppImage's SHA-256 does not match");
    }
  }
  await deps.chmod(temp, 0o755);
  await deps.rename(temp, appImagePath);
}

interface RunDeps extends InstallDeps {
  /** "Restart now?" after the AppImage was swapped; true to restart. */
  askRestart: (update: LinuxUpdate) => Promise<boolean>;
  env: Record<string, string | undefined>;
  exists: (file: string) => boolean;
  fetch: typeof fetch;
  host: string;
  log: (message: string, error?: unknown) => void;
  /** "A new version is out: Download?" for .deb/.rpm, or a failed swap. */
  offerDownload: (update: LinuxUpdate) => Promise<void>;
  /** Already offered in this run (AC-5). */
  offered: Set<string>;
  relaunch: (appImagePath: string) => void;
  repo: string;
  version: string;
}

/**
 * One update check on Linux (docs/specs/linux-updates.md): the AppImage
 * updates itself and asks to restart; .deb and .rpm -- which need root to
 * install -- get a download offer, as does an AppImage that could not be
 * swapped (AC-3, AC-4). Each version is offered once per run, and failures
 * only reach the log (AC-5).
 */
export async function runLinuxUpdateCheck(deps: RunDeps): Promise<void> {
  const format = linuxFormat(deps.env, deps.exists);
  let update: LinuxUpdate | null;
  try {
    update = await checkLinuxUpdate(
      linuxFeedUrl(deps.host, deps.repo, format, deps.version),
      deps.fetch
    );
  } catch (error) {
    deps.log("Could not check for updates", error);
    return;
  }
  if (!update || deps.offered.has(update.name)) {
    return;
  }
  deps.offered.add(update.name);

  const appImagePath = deps.env.APPIMAGE;
  if (format === "appimage" && appImagePath) {
    try {
      await installAppImage(appImagePath, update, deps);
    } catch (error) {
      deps.log("Could not update the AppImage in place", error);
      await deps.offerDownload(update);
      return;
    }
    if (await deps.askRestart(update)) {
      deps.relaunch(appImagePath);
    }
    return;
  }
  await deps.offerDownload(update);
}

/** The dialogs' words, in the system's language (AC-6). */
export function linuxUpdateStrings(locale: string) {
  const portuguese = locale.toLowerCase().startsWith("pt");
  return portuguese
    ? {
        download: "Baixar",
        later: "Depois",
        notNow: "Agora não",
        offerDetail: "Baixe e instale o pacote para atualizar o Personare.",
        offerMessage: (name: string) => `O Personare ${name} está disponível.`,
        restart: "Reiniciar agora",
        restartDetail: "Ela vale a partir da próxima vez que o app abrir.",
        restartMessage: (name: string) =>
          `O Personare ${name} foi baixado e está pronto.`,
      }
    : {
        download: "Download",
        later: "Later",
        notNow: "Not now",
        offerDetail: "Download and install the package to update Personare.",
        offerMessage: (name: string) => `Personare ${name} is available.`,
        restart: "Restart now",
        restartDetail: "It applies the next time the app opens.",
        restartMessage: (name: string) =>
          `Personare ${name} was downloaded and is ready.`,
      };
}
