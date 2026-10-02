import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #96, Spec Driven TDD): src/ipc/attachments does not exist
 * yet, per docs/specs/issue-96-markdown-latex-imagens.md AC-2. An image
 * picked by the user is copied into app.getPath("userData")/attachments/
 * under a freshly generated file name -- the DB only ever stores that file
 * name, never the user's original absolute path (so a future backup/restore
 * stays portable across machines, even though syncing the attachment files
 * themselves is out of scope here).
 */

let userDataDir = "";

vi.mock("electron", () => ({
  app: { getPath: () => userDataDir },
}));

const ROUTER_REGISTRATION_PATTERN = /\battachments\b/;
const PNG_FILE_NAME_PATTERN = /\.png$/;
const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,/;

describe("attachments IPC namespace (Issue #96)", () => {
  let tmpDir: string;
  let sourceImagePath: string;
  let client: Awaited<ReturnType<typeof loadClient>>;

  async function loadClient() {
    const { attachments } = await import("@/ipc/attachments");
    return createRouterClient(attachments);
  }

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "personare-attachments-ipc-")
    );
    userDataDir = path.join(tmpDir, "userData");
    fs.mkdirSync(userDataDir, { recursive: true });
    sourceImagePath = path.join(tmpDir, "source.png");
    fs.writeFileSync(sourceImagePath, Buffer.from([1, 2, 3, 4]));
    vi.resetModules();
    client = await loadClient();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(ROUTER_REGISTRATION_PATTERN);
  });

  describe("saveImage", () => {
    it("copies the source file into userData/attachments under a generated name", async () => {
      const { fileName } = await client.saveImage({
        sourcePath: sourceImagePath,
      });

      expect(fileName).toMatch(PNG_FILE_NAME_PATTERN);
      const copied = fs.readFileSync(
        path.join(userDataDir, "attachments", fileName)
      );
      expect(copied).toEqual(fs.readFileSync(sourceImagePath));
    });

    it("does not use the original absolute path as the stored reference", async () => {
      const { fileName } = await client.saveImage({
        sourcePath: sourceImagePath,
      });

      expect(fileName).not.toBe(sourceImagePath);
      expect(fileName).not.toContain(tmpDir);
    });
  });

  /**
   * docs/specs/quiz-question-single-editor.md: an image pasted from the
   * clipboard has no file path, so the renderer sends its bytes instead.
   */
  describe("saveImageData", () => {
    it("writes the base64 bytes into userData/attachments under a generated name", async () => {
      const { fileName } = await client.saveImageData({
        data: Buffer.from([9, 8, 7]).toString("base64"),
        extension: ".png",
      });

      expect(fileName).toMatch(PNG_FILE_NAME_PATTERN);
      expect(
        fs.readFileSync(path.join(userDataDir, "attachments", fileName))
      ).toEqual(Buffer.from([9, 8, 7]));
    });

    it("rejects an extension that is not an image's", async () => {
      await expect(
        client.saveImageData({ data: "AQID", extension: ".exe" as never })
      ).rejects.toThrow();
    });
  });

  describe("getImageDataUrl", () => {
    it("returns a base64 data URL for a previously saved image", async () => {
      const { fileName } = await client.saveImage({
        sourcePath: sourceImagePath,
      });

      const dataUrl = await client.getImageDataUrl({ fileName });

      expect(dataUrl).toMatch(PNG_DATA_URL_PATTERN);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      expect(Buffer.from(base64, "base64")).toEqual(
        fs.readFileSync(sourceImagePath)
      );
    });
  });

  describe("deleteImage", () => {
    it("removes a previously saved image file", async () => {
      const { fileName } = await client.saveImage({
        sourcePath: sourceImagePath,
      });

      await client.deleteImage({ fileName });

      expect(
        fs.existsSync(path.join(userDataDir, "attachments", fileName))
      ).toBe(false);
    });
  });
});
