import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { os } from "@orpc/server";
import { app } from "electron";
import {
  deleteImageInputSchema,
  getImageDataUrlInputSchema,
  saveImageDataInputSchema,
  saveImageInputSchema,
} from "./schemas";

const EXTENSION_MIME_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const DEFAULT_MIME_TYPE = "application/octet-stream";

function attachmentsDir() {
  const dir = path.join(app.getPath("userData"), "attachments");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const saveImage = os.input(saveImageInputSchema).handler(({ input }) => {
  const extension = path.extname(input.sourcePath);
  const fileName = `${randomUUID()}${extension}`;

  fs.copyFileSync(input.sourcePath, path.join(attachmentsDir(), fileName));

  return { fileName };
});

export const saveImageData = os
  .input(saveImageDataInputSchema)
  .handler(({ input }) => {
    const fileName = `${randomUUID()}${input.extension}`;

    fs.writeFileSync(
      path.join(attachmentsDir(), fileName),
      Buffer.from(input.data, "base64")
    );

    return { fileName };
  });

export const getImageDataUrl = os
  .input(getImageDataUrlInputSchema)
  .handler(({ input }) => {
    const data = fs.readFileSync(path.join(attachmentsDir(), input.fileName));
    const mimeType =
      EXTENSION_MIME_TYPES[path.extname(input.fileName).toLowerCase()] ??
      DEFAULT_MIME_TYPE;

    return `data:${mimeType};base64,${data.toString("base64")}`;
  });

export const deleteImage = os
  .input(deleteImageInputSchema)
  .handler(({ input }) => {
    fs.rmSync(path.join(attachmentsDir(), input.fileName), { force: true });
  });
