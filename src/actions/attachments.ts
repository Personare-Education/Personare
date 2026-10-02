import { ipc } from "@/ipc/manager";

export function saveAttachmentImage(sourcePath: string) {
  return ipc.client.attachments.saveImage({ sourcePath });
}

/** For a pasted clipboard image, which has no path: its base64 bytes. */
export function saveAttachmentImageData(
  data: string,
  extension: ".gif" | ".jpeg" | ".jpg" | ".png" | ".webp"
) {
  return ipc.client.attachments.saveImageData({ data, extension });
}

export function getAttachmentImageDataUrl(fileName: string) {
  return ipc.client.attachments.getImageDataUrl({ fileName });
}

export function deleteAttachmentImage(fileName: string) {
  return ipc.client.attachments.deleteImage({ fileName });
}
