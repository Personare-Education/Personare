import { nativeImage } from "electron";

const ICON_SIZE = 32;
const RGBA_CHANNELS = 4;
const CENTER = ICON_SIZE / 2;
const RADIUS = ICON_SIZE / 2 - 2;

/**
 * Placeholder Tray icon, generated in memory -- no brand asset exists yet
 * (see docs/specs/issue-20-notificacao-boot.md). A solid circle filled by
 * distance to center, built as a raw RGBA buffer, no font/image lib needed.
 *
 * macOS sizes menu bar icons in points: marked as @2x, the 32px buffer shows
 * at 16pt, crisp on Retina (docs/specs/macos-build.md).
 */
export function createPlaceholderTrayIcon(
  platform: NodeJS.Platform = process.platform
): Electron.NativeImage {
  const buffer = Buffer.alloc(ICON_SIZE * ICON_SIZE * RGBA_CHANNELS);

  for (let y = 0; y < ICON_SIZE; y += 1) {
    for (let x = 0; x < ICON_SIZE; x += 1) {
      const dx = x - CENTER + 0.5;
      const dy = y - CENTER + 0.5;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > RADIUS) {
        continue;
      }

      const index = (y * ICON_SIZE + x) * RGBA_CHANNELS;
      buffer[index] = 37;
      buffer[index + 1] = 99;
      buffer[index + 2] = 235;
      buffer[index + 3] = 255;
    }
  }

  return nativeImage.createFromBuffer(buffer, {
    height: ICON_SIZE,
    width: ICON_SIZE,
    ...(platform === "darwin" ? { scaleFactor: 2 } : {}),
  });
}
