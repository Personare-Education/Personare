import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #20, Spec Driven TDD): src/main/tray-icon.ts does not
 * exist yet. Every test below is expected to fail until the Developer
 * implements createPlaceholderTrayIcon, per
 * docs/specs/issue-20-notificacao-boot.md AC-2.
 *
 * Approach investigated and chosen: Electron's own `electron` npm package,
 * when required outside of the real Electron binary -- exactly what
 * happens here, under plain Node/Vitest with the jsdom environment (see
 * vitest.config.ts) -- does not expose a working `nativeImage` API; its
 * package.json "main" resolves to the path of the Electron executable
 * instead of the native module. This repo has no lightweight "run this one
 * unit test file inside a real Electron process" harness -- the only thing
 * that launches a real Electron process is the Playwright e2e suite
 * (src/tests/e2e/*, via electron-playwright-helpers), which requires a full
 * packaged build first and targets end-to-end UI flows, not a single pure
 * function. So, mirroring the precedent already established by
 * src/tests/unit/dialog-ipc.test.ts (which mocks electron's `dialog` for
 * the exact same reason), this suite mocks electron's `nativeImage.
 * createFromBuffer` and asserts on what createPlaceholderTrayIcon feeds
 * it: a 32x32 RGBA buffer (4 bytes/pixel) that is genuinely "not empty" --
 * real, opaque pixel data forming a filled circle by distance to center
 * (per AC-2), not an all-zero/fully-transparent buffer -- plus the
 * pass-through of createFromBuffer's return value as the function's own
 * return value.
 */

const createFromBufferMock = vi.fn();

vi.mock("electron", () => ({
  nativeImage: {
    createFromBuffer: (...args: unknown[]) => createFromBufferMock(...args),
  },
}));

const { createPlaceholderTrayIcon } = await import("@/main/tray-icon");

const ICON_SIZE = 32;
const RGBA_CHANNELS = 4;

describe("createPlaceholderTrayIcon (Issue #20)", () => {
  beforeEach(() => {
    createFromBufferMock.mockReset();
  });

  it("builds a 32x32 RGBA buffer and passes it to nativeImage.createFromBuffer with matching dimensions", () => {
    createFromBufferMock.mockReturnValue({ isEmpty: () => false });

    createPlaceholderTrayIcon();

    expect(createFromBufferMock).toHaveBeenCalledTimes(1);
    const [buffer, options] = createFromBufferMock.mock.calls[0] as [
      Buffer,
      { height: number; width: number },
    ];
    expect(buffer).toHaveLength(ICON_SIZE * ICON_SIZE * RGBA_CHANNELS);
    expect(options).toEqual({ height: ICON_SIZE, width: ICON_SIZE });
  });

  it("draws real, opaque pixel data -- not an empty/fully-transparent buffer", () => {
    createFromBufferMock.mockReturnValue({ isEmpty: () => false });

    createPlaceholderTrayIcon();

    const [buffer] = createFromBufferMock.mock.calls.at(-1) as [Buffer];
    expect(buffer.some((byte) => byte !== 0)).toBe(true);

    // Personare's logo (docs/specs/app-icon.md): a 2x2 grid of rounded
    // squares in the brand blue, fading from faint (top left) to solid
    // (bottom right), with a transparent gap between them.
    function alphaAt(x: number, y: number) {
      return buffer[(y * ICON_SIZE + x) * RGBA_CHANNELS + 3];
    }
    const topLeft = alphaAt(8, 8);
    const bottomRight = alphaAt(24, 24);
    expect(topLeft).toBeGreaterThan(0);
    expect(bottomRight).toBe(255);
    expect(topLeft).toBeLessThan(bottomRight);
    expect(alphaAt(16, 16)).toBe(0);
    const brandBlue = (24 * ICON_SIZE + 24) * RGBA_CHANNELS;
    expect([...buffer.subarray(brandBlue, brandBlue + 3)]).toEqual([
      0x3b, 0x6c, 0xf6,
    ]);
  });

  it("returns whatever nativeImage.createFromBuffer returns", () => {
    const fakeIcon = { isEmpty: () => false };
    createFromBufferMock.mockReturnValue(fakeIcon);

    expect(createPlaceholderTrayIcon()).toBe(fakeIcon);
  });

  /*
   * Spec: docs/specs/macos-build.md -- macOS sizes menu bar icons in points:
   * the 32px buffer marked as @2x shows at 16pt, crisp on Retina, instead of
   * a 32pt circle towering over the menu bar.
   */
  it("marks the icon as @2x on macOS", () => {
    createFromBufferMock.mockReturnValue({ isEmpty: () => false });

    createPlaceholderTrayIcon("darwin");

    const [, options] = createFromBufferMock.mock.calls.at(-1) as [
      Buffer,
      { scaleFactor?: number },
    ];
    expect(options).toEqual({
      height: ICON_SIZE,
      scaleFactor: 2,
      width: ICON_SIZE,
    });
  });

  it("keeps the icon at 1x elsewhere", () => {
    createFromBufferMock.mockReturnValue({ isEmpty: () => false });

    createPlaceholderTrayIcon("win32");

    const [, options] = createFromBufferMock.mock.calls.at(-1) as [
      Buffer,
      { scaleFactor?: number },
    ];
    expect(options).toEqual({ height: ICON_SIZE, width: ICON_SIZE });
  });
});
