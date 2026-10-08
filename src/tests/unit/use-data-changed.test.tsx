import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDataChanged } from "@/hooks/use-data-changed";

/**
 * RED phase (docs/specs/mcp-create-program.md AC-6): what the MCP bridge
 * changes, the open window reloads, through the preload's onDataChanged.
 */

let listener: ((topic: string) => void) | undefined;
const unsubscribe = vi.fn();

function installBridge() {
  window.personare = {
    getPathForFile: () => "",
    onDataChanged: (callback) => {
      listener = callback;
      return unsubscribe;
    },
  };
}

afterEach(() => {
  listener = undefined;
  unsubscribe.mockClear();
  window.personare = undefined;
});

describe("useDataChanged", () => {
  it("reloads when its topic changes, and only then", () => {
    installBridge();
    const reload = vi.fn();
    renderHook(() => useDataChanged("programs", reload));

    act(() => listener?.("modules"));
    expect(reload).not.toHaveBeenCalled();

    act(() => listener?.("programs"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stops listening when the page goes away", () => {
    installBridge();
    const { unmount } = renderHook(() => useDataChanged("programs", vi.fn()));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it("does nothing outside Electron, where there is no preload", () => {
    expect(() =>
      renderHook(() => useDataChanged("programs", vi.fn()))
    ).not.toThrow();
  });
});
