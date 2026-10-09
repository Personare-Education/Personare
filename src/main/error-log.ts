import fs from "node:fs";
import path from "node:path";
import { format } from "node:util";
import type { App, Details, RenderProcessGoneDetails } from "electron";

/**
 * The local error log (docs/specs/error-log.md): one JSON line per error
 * in <userData>/logs/errors.log. Nothing leaves the computer on its own;
 * the student exports it from Settings and decides who gets it.
 */

export type ErrorSource = "main" | "renderer";

export interface ErrorLogEntry {
  message: string;
  source: ErrorSource;
  stack?: string;
  time: string;
  version: string;
}

interface ErrorLogOptions {
  appVersion: string;
  /** Past this, the file becomes errors.log.1 and a new one starts. */
  maxBytes?: number;
  now?: () => Date;
}

const DEFAULT_MAX_BYTES = 512 * 1024;
const MAX_FIELD_LENGTH = 8 * 1024;

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const stack =
      "stack" in error && typeof error.stack === "string"
        ? error.stack
        : undefined;
    return { message: error.message, stack };
  }
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

function clip(text: string | undefined): string | undefined {
  return text && text.length > MAX_FIELD_LENGTH
    ? `${text.slice(0, MAX_FIELD_LENGTH)}…`
    : text;
}

function parseLines(text: string): ErrorLogEntry[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as ErrorLogEntry];
      } catch {
        return [];
      }
    });
}

function readIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

export function createErrorLog(filePath: string, options: ErrorLogOptions) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const now = options.now ?? (() => new Date());
  const previousPath = `${filePath}.1`;

  function rotateIfFull(incomingBytes: number) {
    let size = 0;
    try {
      ({ size } = fs.statSync(filePath));
    } catch {
      return;
    }
    if (size > 0 && size + incomingBytes > maxBytes) {
      fs.renameSync(filePath, previousPath);
    }
  }

  return {
    /**
     * Writes a readable copy to `target`; false (and no file) when nothing
     * was recorded.
     */
    exportTo(target: string, system: string): boolean {
      const entries = this.read();
      if (entries.length === 0) {
        return false;
      }
      const header = [
        `Personare ${options.appVersion}`,
        system,
        `Exported ${now().toISOString()}`,
        "",
      ];
      const body = entries.flatMap((entry) => [
        `[${entry.time}] ${entry.source} (${entry.version}): ${entry.message}`,
        ...(entry.stack ? [entry.stack] : []),
        "",
      ]);
      fs.writeFileSync(target, [...header, ...body].join("\n"));
      return true;
    },

    /** Every kept entry, oldest first. */
    read(): ErrorLogEntry[] {
      return [
        ...parseLines(readIfExists(previousPath)),
        ...parseLines(readIfExists(filePath)),
      ];
    },
    /** Writes one error. Never throws: a failed write is dropped. */
    record(source: ErrorSource, error: unknown) {
      try {
        const { message, stack } = describe(error);
        const entry: ErrorLogEntry = {
          message: clip(message) ?? "",
          source,
          stack: clip(stack),
          time: now().toISOString(),
          version: options.appVersion,
        };
        const line = `${JSON.stringify(entry)}\n`;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        rotateIfFull(Buffer.byteLength(line));
        fs.appendFileSync(filePath, line);
      } catch {
        // Logging an error must never raise another one.
      }
    },
  };
}

export type ErrorLog = ReturnType<typeof createErrorLog>;

type ProcessLike = Pick<NodeJS.Process, "on">;
type AppLike = Pick<App, "on">;
type ConsoleLike = Pick<Console, "error">;

/**
 * Hooks the main process into the log (AC-1). uncaughtExceptionMonitor
 * only watches, so Electron's own handling of the exception is unchanged;
 * console.error keeps printing, and also records.
 */
export function captureMainProcessErrors(
  log: ErrorLog,
  targets: { app: AppLike; console: ConsoleLike; process: ProcessLike }
) {
  targets.process.on("uncaughtExceptionMonitor", (error) => {
    log.record("main", error);
  });
  targets.process.on("unhandledRejection", (reason) => {
    log.record("main", reason);
  });

  const printError = targets.console.error.bind(targets.console);
  targets.console.error = (...args: unknown[]) => {
    printError(...args);
    const error = args.find((arg) => arg instanceof Error);
    const message = format(
      ...args.map((arg) => (arg instanceof Error ? arg.message : arg))
    );
    log.record("main", { message, stack: error?.stack });
  };

  targets.app.on(
    "render-process-gone",
    (_event, _contents, details: RenderProcessGoneDetails) => {
      log.record("main", `Window process gone: ${details.reason}`);
    }
  );
  targets.app.on("child-process-gone", (_event, details: Details) => {
    log.record("main", `${details.type} process gone: ${details.reason}`);
  });
}
