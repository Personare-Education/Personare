import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * docs/specs/audit-a11y-leftovers.md AC-4b: with no saved theme the app
 * follows the system, so a dark system must paint the page dark too --
 * otherwise the first "toggle" flips Electron to light while the page,
 * already light, does not change. Only the main process knows what
 * "system" resolves to, so setThemeMode reports it.
 */

const setThemeMode = vi.fn();
vi.mock("@/ipc/manager", () => ({
  ipc: {
    client: {
      theme: {
        getCurrentThemeMode: vi.fn().mockResolvedValue("system"),
        setThemeMode,
        toggleThemeMode: vi.fn(),
      },
    },
  },
}));

const { setTheme } = await import("@/actions/theme");

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("setTheme", () => {
  it("paints the page dark when the system it follows is dark", async () => {
    setThemeMode.mockResolvedValue(true);
    await setTheme("system");

    expect(setThemeMode).toHaveBeenCalledWith("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("paints the page light when the system it follows is light", async () => {
    setThemeMode.mockResolvedValue(false);
    await setTheme("system");

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("paints what a chosen theme turns out to be", async () => {
    setThemeMode.mockResolvedValue(true);
    await setTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    setThemeMode.mockResolvedValue(false);
    await setTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
