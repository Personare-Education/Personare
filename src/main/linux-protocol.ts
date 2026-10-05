import path from "node:path";
import { OAUTH_PROTOCOL } from "@/constants";

/** The scheme's MIME type on freedesktop systems. */
export const PROTOCOL_MIME_TYPE = `x-scheme-handler/${OAUTH_PROTOCOL}`;

const DESKTOP_FILE_NAME = "personare-appimage.desktop";

/**
 * One Exec argument, quoted as the Desktop Entry spec asks: inside double
 * quotes, `"`, `` ` ``, `$` and `\` are escaped with a backslash
 * (docs/specs/linux-appimage-protocol.md AC-2).
 */
export function quoteDesktopExecArg(value: string): string {
  return `"${value.replace(/["`$\\]/g, (char) => `\\${char}`)}"`;
}

/**
 * The entry that sends personare:// links to this AppImage: hidden from the
 * menu (the user's own launcher stays the only shortcut), opened with the
 * URL as its argument (AC-1).
 */
export function appImageDesktopEntry(appImagePath: string): string {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Personare",
    `Exec=${quoteDesktopExecArg(appImagePath)} %u`,
    "Terminal=false",
    "NoDisplay=true",
    `MimeType=${PROTOCOL_MIME_TYPE};`,
    "",
  ].join("\n");
}

interface RegisterDeps {
  env: Record<string, string | undefined>;
  homeDir: string;
  log: (message: string, error?: unknown) => void;
  mkdir: (dir: string, options: { recursive: true }) => Promise<unknown>;
  platform: string;
  run: (command: string, args: string[]) => Promise<unknown>;
  writeFile: (file: string, content: string) => Promise<unknown>;
}

/**
 * An AppImage installs no .desktop file and runs from a mount that changes
 * every launch, so nothing maps personare:// to it and the Google login's
 * callback never reaches the app. Each launch writes an entry pointing at
 * the AppImage's real path ($APPIMAGE) and makes it the scheme's handler
 * (AC-1, AC-3). Failures are logged, never thrown (AC-4).
 */
export async function registerAppImageProtocolHandler(
  deps: RegisterDeps
): Promise<void> {
  const appImagePath = deps.env.APPIMAGE;
  if (deps.platform !== "linux" || !appImagePath) {
    return;
  }
  const applicationsDir = path.posix.join(
    deps.homeDir.replace(/\\/g, "/"),
    ".local/share/applications"
  );
  try {
    await deps.mkdir(applicationsDir, { recursive: true });
    await deps.writeFile(
      path.posix.join(applicationsDir, DESKTOP_FILE_NAME),
      appImageDesktopEntry(appImagePath)
    );
    await deps.run("xdg-mime", [
      "default",
      DESKTOP_FILE_NAME,
      PROTOCOL_MIME_TYPE,
    ]);
  } catch (error) {
    deps.log(
      "Could not register the personare:// handler for the AppImage",
      error
    );
  }
}
