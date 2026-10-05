import { describe, expect, it, vi } from "vitest";
import {
  appImageDesktopEntry,
  quoteDesktopExecArg,
  registerAppImageProtocolHandler,
} from "@/main/linux-protocol";

/**
 * RED phase (docs/specs/linux-appimage-protocol.md): an AppImage installs
 * nothing, so the app registers personare:// for itself when it runs.
 */

describe("quoteDesktopExecArg (AC-2)", () => {
  it("quotes a path, escaping what the .desktop spec reserves", () => {
    expect(quoteDesktopExecArg("/home/ana/Apps/Personare 1.AppImage")).toBe(
      '"/home/ana/Apps/Personare 1.AppImage"'
    );
    expect(quoteDesktopExecArg('/opt/a"b$c`d\\e.AppImage')).toBe(
      '"/opt/a\\"b\\$c\\`d\\\\e.AppImage"'
    );
  });
});

describe("appImageDesktopEntry (AC-1)", () => {
  it("opens the AppImage with the URL, handles personare://, and stays off the menu", () => {
    const entry = appImageDesktopEntry("/home/ana/Personare.AppImage");

    expect(entry).toContain("[Desktop Entry]");
    expect(entry).toContain('Exec="/home/ana/Personare.AppImage" %u');
    expect(entry).toContain("MimeType=x-scheme-handler/personare;");
    expect(entry).toContain("NoDisplay=true");
    expect(entry).toContain("Type=Application");
  });
});

describe("registerAppImageProtocolHandler", () => {
  function deps(overrides: Record<string, unknown> = {}) {
    return {
      env: { APPIMAGE: "/home/ana/Personare.AppImage" },
      homeDir: "/home/ana",
      log: vi.fn(),
      mkdir: vi.fn().mockResolvedValue(undefined),
      platform: "linux",
      run: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it("writes the entry and makes it the personare:// handler (AC-1, AC-3)", async () => {
    const d = deps();

    await registerAppImageProtocolHandler(d as never);

    expect(d.writeFile).toHaveBeenCalledWith(
      "/home/ana/.local/share/applications/personare-appimage.desktop",
      appImageDesktopEntry("/home/ana/Personare.AppImage")
    );
    expect(d.run).toHaveBeenCalledWith("xdg-mime", [
      "default",
      "personare-appimage.desktop",
      "x-scheme-handler/personare",
    ]);
  });

  it("does nothing outside an AppImage (AC-5)", async () => {
    const d = deps({ env: {} });
    await registerAppImageProtocolHandler(d as never);
    const mac = deps({ platform: "darwin" });
    await registerAppImageProtocolHandler(mac as never);

    expect(d.writeFile).not.toHaveBeenCalled();
    expect(mac.writeFile).not.toHaveBeenCalled();
  });

  it("logs a failure instead of throwing (AC-4)", async () => {
    const d = deps({
      run: vi.fn().mockRejectedValue(new Error("no xdg-mime")),
    });

    await expect(registerAppImageProtocolHandler(d as never)).resolves.toBe(
      undefined
    );
    expect(d.log).toHaveBeenCalled();
  });
});
