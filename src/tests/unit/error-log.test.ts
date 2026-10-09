import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { App } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureMainProcessErrors, createErrorLog } from "@/main/error-log";

/** docs/specs/error-log.md AC-2 to AC-5. */

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-error-log-"));
  file = path.join(dir, "logs", "errors.log");
});

afterEach(() => {
  fs.rmSync(dir, { force: true, recursive: true });
});

const NOW = new Date("2026-10-09T12:00:00.000Z");

function lines(filePath: string) {
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

describe("createErrorLog", () => {
  it("appends one JSON line per error, creating the folder", () => {
    const log = createErrorLog(file, { appVersion: "1.2.3", now: () => NOW });

    log.record("main", new Error("boom"));
    log.record("renderer", { message: "bad", stack: "at x" });

    const [first, second] = lines(file);
    expect(first).toMatchObject({
      message: "boom",
      source: "main",
      time: NOW.toISOString(),
      version: "1.2.3",
    });
    expect(first.stack).toContain("boom");
    expect(second).toMatchObject({
      message: "bad",
      source: "renderer",
      stack: "at x",
    });
  });

  it("records values that are not errors as text", () => {
    const log = createErrorLog(file, { appVersion: "1", now: () => NOW });

    log.record("main", "plain text");
    log.record("main", { reason: 42 });

    const [first, second] = lines(file);
    expect(first.message).toBe("plain text");
    expect(second.message).toBe('{"reason":42}');
  });

  it("rotates to errors.log.1 past the size limit, keeping one old file", () => {
    const log = createErrorLog(file, {
      appVersion: "1",
      maxBytes: 300,
      now: () => NOW,
    });

    for (let i = 0; i < 12; i += 1) {
      log.record("main", new Error(`error ${i}`));
    }

    expect(fs.existsSync(`${file}.1`)).toBe(true);
    expect(fs.existsSync(`${file}.2`)).toBe(false);
    const kept = log.read();
    expect(kept.length).toBeLessThan(12);
    expect(kept.at(-1)?.message).toBe("error 11");
  });

  it("never throws when the file can't be written", () => {
    fs.mkdirSync(file, { recursive: true });
    const log = createErrorLog(file, { appVersion: "1", now: () => NOW });

    expect(() => log.record("main", new Error("x"))).not.toThrow();
  });

  it("exports a header and the errors, oldest first", () => {
    const log = createErrorLog(file, { appVersion: "1.2.3", now: () => NOW });
    for (let i = 0; i < 6; i += 1) {
      log.record("main", new Error(`error ${i}`));
    }
    const target = path.join(dir, "export.txt");

    expect(log.exportTo(target, "linux x64")).toBe(true);

    const text = fs.readFileSync(target, "utf8");
    expect(text).toContain("Personare 1.2.3");
    expect(text).toContain("linux x64");
    expect(text.indexOf("error 0")).toBeLessThan(text.indexOf("error 5"));
  });

  it("exports nothing when no error was recorded", () => {
    const log = createErrorLog(file, { appVersion: "1", now: () => NOW });
    const target = path.join(dir, "export.txt");

    expect(log.exportTo(target, "linux x64")).toBe(false);
    expect(fs.existsSync(target)).toBe(false);
  });
});

describe("captureMainProcessErrors (AC-1)", () => {
  function setup() {
    const log = createErrorLog(file, { appVersion: "1", now: () => NOW });
    const proc = new EventEmitter();
    const app = new EventEmitter();
    const print = vi.fn();
    const fakeConsole = { error: print };
    captureMainProcessErrors(log, {
      app: app as unknown as App,
      console: fakeConsole,
      process: proc as unknown as NodeJS.Process,
    });
    return { app, fakeConsole, log, print, proc };
  }

  it("records uncaught exceptions and unhandled rejections", () => {
    const { log, proc } = setup();

    proc.emit("uncaughtExceptionMonitor", new Error("thrown"));
    proc.emit("unhandledRejection", new Error("rejected"));

    expect(log.read().map((entry) => entry.message)).toEqual([
      "thrown",
      "rejected",
    ]);
  });

  it("records console.error and still prints it", () => {
    const { fakeConsole, log, print } = setup();

    fakeConsole.error("Could not start:", new Error("EADDRINUSE"));

    expect(print).toHaveBeenCalledOnce();
    const [entry] = log.read();
    expect(entry.message).toBe("Could not start: EADDRINUSE");
    expect(entry.stack).toContain("EADDRINUSE");
  });

  it("records a window or helper process that is gone", () => {
    const { app, log } = setup();

    app.emit("render-process-gone", {}, {}, { reason: "crashed" });
    app.emit("child-process-gone", {}, { reason: "oom", type: "GPU" });

    expect(log.read().map((entry) => entry.message)).toEqual([
      "Window process gone: crashed",
      "GPU process gone: oom",
    ]);
  });
});
