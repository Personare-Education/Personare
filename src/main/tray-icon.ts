import { nativeImage } from "electron";

const ICON_SIZE = 32;
const RGBA_CHANNELS = 4;
const BRAND_BLUE = [0x3b, 0x6c, 0xf6] as const;

/** The logo's viewBox is 24 units wide; this scales it to the icon. */
const SCALE = ICON_SIZE / 24;
const SQUARE = 10 * SCALE;
const CORNER = 2.5 * SCALE;

/**
 * Personare's logo as a 2x2 grid of rounded squares (docs/specs/app-icon.md),
 * all brand blue so it reads on light and dark bars alike, fading from the
 * top-left square to the solid bottom-right one.
 */
const SQUARES = [
  { opacity: 0.35, x: 1, y: 1 },
  { opacity: 0.55, x: 13, y: 1 },
  { opacity: 0.75, x: 1, y: 13 },
  { opacity: 1, x: 13, y: 13 },
].map((square) => ({
  ...square,
  left: square.x * SCALE,
  top: square.y * SCALE,
}));

/** Whether a pixel center falls inside a rounded square. */
function isInside(px: number, py: number, left: number, top: number) {
  const right = left + SQUARE;
  const bottom = top + SQUARE;
  if (px < left || px > right || py < top || py > bottom) {
    return false;
  }
  const cx = Math.min(Math.max(px, left + CORNER), right - CORNER);
  const cy = Math.min(Math.max(py, top + CORNER), bottom - CORNER);
  return (px - cx) ** 2 + (py - cy) ** 2 <= CORNER ** 2;
}

/**
 * Tray icon, generated in memory from Personare's logo (a placeholder until
 * the final brand asset) -- a raw RGBA buffer, no image file or lib needed.
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
      const square = SQUARES.find(({ left, top }) =>
        isInside(x + 0.5, y + 0.5, left, top)
      );
      if (!square) {
        continue;
      }

      const index = (y * ICON_SIZE + x) * RGBA_CHANNELS;
      buffer[index] = BRAND_BLUE[0];
      buffer[index + 1] = BRAND_BLUE[1];
      buffer[index + 2] = BRAND_BLUE[2];
      buffer[index + 3] = Math.round(square.opacity * 255);
    }
  }

  return nativeImage.createFromBuffer(buffer, {
    height: ICON_SIZE,
    width: ICON_SIZE,
    ...(platform === "darwin" ? { scaleFactor: 2 } : {}),
  });
}
