import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { errorLog } from "@/ipc/error-log";
import { setErrorLog } from "@/ipc/error-log/state";
import { createErrorLog } from "@/main/error-log";

/** docs/specs/error-log.md AC-1 and AC-5, through the oRPC namespace. */

const ROUTER_REGISTRATION = /^\s+errorLog,$/m;

let dir: string;
const client = createRouterClient(errorLog);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-error-log-ipc-"));
  setErrorLog(
    createErrorLog(path.join(dir, "errors.log"), { appVersion: "9.9.9" })
  );
});

afterEach(() => {
  fs.rmSync(dir, { force: true, recursive: true });
});

describe("errorLog IPC namespace", () => {
  it("is registered on the root router", () => {
    // Importing the router needs a main window; read its source instead,
    // like the other namespaces' tests.
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../ipc/router.ts"),
      "utf8"
    );
    expect(source).toMatch(ROUTER_REGISTRATION);
  });

  it("records the window's errors and exports them", async () => {
    await client.recordRendererError({
      message: "render failed",
      stack: "at A",
    });
    const target = path.join(dir, "out.txt");

    const result = await client.exportErrorLog({ filePath: target });

    expect(result).toEqual({ exported: true });
    const text = fs.readFileSync(target, "utf8");
    expect(text).toContain("Personare 9.9.9");
    expect(text).toContain("renderer (9.9.9): render failed");
    expect(text).toContain("at A");
  });

  it("exports nothing when no error was recorded", async () => {
    const target = path.join(dir, "out.txt");

    expect(await client.exportErrorLog({ filePath: target })).toEqual({
      exported: false,
    });
    expect(fs.existsSync(target)).toBe(false);
  });
});
