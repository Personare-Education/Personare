import { z } from "zod";

export const saveImageInputSchema = z.object({
  sourcePath: z.string(),
});

/** An image pasted from the clipboard: its bytes (base64), no file path. */
export const saveImageDataInputSchema = z.object({
  data: z.string(),
  extension: z.enum([".gif", ".jpeg", ".jpg", ".png", ".webp"]),
});

export const getImageDataUrlInputSchema = z.object({
  fileName: z.string(),
});

export const deleteImageInputSchema = z.object({
  fileName: z.string(),
});
