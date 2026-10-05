import { describe, expect, it, vi } from "vitest";
import {
  checkLinuxUpdate,
  installAppImage,
  type LinuxUpdate,
  linuxFeedUrl,
  linuxFormat,
  runLinuxUpdateCheck,
} from "@/main/linux-updater";

/**
 * RED phase (docs/specs/linux-updates.md): Linux updates itself as an
 * AppImage, and offers the download for .deb and .rpm.
 */

const UPDATE: LinuxUpdate = {
  name: "v0.1.0-alpha.11",
  sha256: "a".repeat(64),
  size: 100,
  url: "https://github.com/o/r/releases/download/v0.1.0-alpha.11/Personare-0.1.0-alpha.11-x64.AppImage",
};

describe("linuxFormat (AC-1)", () => {
  it("tells the AppImage, .deb and .rpm installs apart", () => {
    expect(linuxFormat({ APPIMAGE: "/home/a/P.AppImage" }, () => false)).toBe(
      "appimage"
    );
    expect(linuxFormat({}, (path) => path === "/etc/debian_version")).toBe(
      "deb"
    );
    expect(linuxFormat({}, () => false)).toBe("rpm");
  });
});

describe("linuxFeedUrl (AC-1)", () => {
  it("asks the channel's feed for this format and version", () => {
    expect(
      linuxFeedUrl(
        "https://api.example.com/updates/prerelease",
        "o/r",
        "deb",
        "0.1.0-alpha.10"
      )
    ).toBe(
      "https://api.example.com/updates/prerelease/o/r/linux-x64-deb/0.1.0-alpha.10"
    );
  });
});

describe("checkLinuxUpdate", () => {
  it("reads a newer version, and nothing on 204", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(UPDATE))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(checkLinuxUpdate("https://x", fetchMock)).resolves.toEqual(
      UPDATE
    );
    await expect(checkLinuxUpdate("https://x", fetchMock)).resolves.toBeNull();
  });
});

describe("installAppImage (AC-2)", () => {
  function deps(sha256: string) {
    return {
      chmod: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn().mockResolvedValue(undefined),
      sha256File: vi.fn().mockResolvedValue(sha256),
      unlink: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("downloads beside the AppImage, checks it, makes it executable and swaps it in", async () => {
    const d = deps("a".repeat(64));

    await installAppImage("/home/ana/Apps/Personare.AppImage", UPDATE, d);

    const temp = "/home/ana/Apps/.Personare.AppImage.update";
    expect(d.download).toHaveBeenCalledWith(UPDATE.url, temp);
    expect(d.chmod).toHaveBeenCalledWith(temp, 0o755);
    expect(d.rename).toHaveBeenCalledWith(
      temp,
      "/home/ana/Apps/Personare.AppImage"
    );
  });

  it("throws the download away when its SHA-256 does not match", async () => {
    const d = deps("b".repeat(64));

    await expect(
      installAppImage("/home/ana/Apps/Personare.AppImage", UPDATE, d)
    ).rejects.toThrow("SHA-256");
    expect(d.rename).not.toHaveBeenCalled();
    expect(d.unlink).toHaveBeenCalledWith(
      "/home/ana/Apps/.Personare.AppImage.update"
    );
  });
});

describe("runLinuxUpdateCheck", () => {
  function deps(overrides: Record<string, unknown> = {}) {
    return {
      askRestart: vi.fn().mockResolvedValue(true),
      chmod: vi.fn().mockResolvedValue(undefined),
      download: vi.fn().mockResolvedValue(undefined),
      env: { APPIMAGE: "/home/ana/Personare.AppImage" },
      exists: () => false,
      // A fresh Response each call: a body can only be read once.
      fetch: vi.fn().mockImplementation(async () => Response.json(UPDATE)),
      host: "https://api.example.com/updates/prerelease",
      log: vi.fn(),
      offerDownload: vi.fn().mockResolvedValue(undefined),
      offered: new Set<string>(),
      relaunch: vi.fn(),
      rename: vi.fn().mockResolvedValue(undefined),
      repo: "o/r",
      sha256File: vi.fn().mockResolvedValue("a".repeat(64)),
      unlink: vi.fn().mockResolvedValue(undefined),
      version: "0.1.0-alpha.10",
      ...overrides,
    };
  }

  it("swaps the AppImage and restarts when asked to (AC-2)", async () => {
    const d = deps();

    await runLinuxUpdateCheck(d as never);

    expect(d.rename).toHaveBeenCalled();
    expect(d.askRestart).toHaveBeenCalledWith(UPDATE);
    expect(d.relaunch).toHaveBeenCalledWith("/home/ana/Personare.AppImage");
    expect(d.offerDownload).not.toHaveBeenCalled();
  });

  it("offers the download when the AppImage cannot be swapped (AC-3)", async () => {
    const d = deps({
      rename: vi.fn().mockRejectedValue(new Error("EACCES")),
    });

    await runLinuxUpdateCheck(d as never);

    expect(d.offerDownload).toHaveBeenCalledWith(UPDATE);
    expect(d.relaunch).not.toHaveBeenCalled();
  });

  it("offers the download for a .deb, once per version (AC-4, AC-5)", async () => {
    const d = deps({ env: {}, exists: () => true });

    await runLinuxUpdateCheck(d as never);
    await runLinuxUpdateCheck(d as never);

    expect(d.offerDownload).toHaveBeenCalledTimes(1);
    expect(d.download).not.toHaveBeenCalled();
    const [url] = d.fetch.mock.calls[0] as [string];
    expect(url).toContain("/linux-x64-deb/0.1.0-alpha.10");
  });

  it("only logs a feed failure (AC-5)", async () => {
    const d = deps({ fetch: vi.fn().mockRejectedValue(new Error("offline")) });

    await expect(runLinuxUpdateCheck(d as never)).resolves.toBeUndefined();
    expect(d.log).toHaveBeenCalled();
  });
});
