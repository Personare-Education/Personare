import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSidebarAutoCollapse } from "@/hooks/use-sidebar-auto-collapse";

/**
 * RED phase (docs/specs/audit-a11y.md AC-5): below 1024px the sidebar
 * collapses to its icons, and opens again above it; the collapse control
 * keeps working in between.
 */

function mockMatchMedia(initiallyNarrow: boolean) {
  let listener: ((event: { matches: boolean }) => void) | null = null;
  const original = window.matchMedia;
  window.matchMedia = vi.fn((query: string) => ({
    addEventListener: (
      _: string,
      cb: (event: { matches: boolean }) => void
    ) => {
      listener = cb;
    },
    matches: initiallyNarrow,
    media: query,
    removeEventListener: () => {
      listener = null;
    },
  })) as unknown as typeof window.matchMedia;
  return {
    resize(narrow: boolean) {
      act(() => listener?.({ matches: narrow }));
    },
    restore() {
      window.matchMedia = original;
    },
  };
}

let media: ReturnType<typeof mockMatchMedia>;
afterEach(() => media.restore());

describe("useSidebarAutoCollapse", () => {
  it("starts collapsed in a narrow window", () => {
    media = mockMatchMedia(true);
    const { result } = renderHook(() => useSidebarAutoCollapse());

    expect(result.current.open).toBe(false);
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
  });

  it("starts open in a wide window", () => {
    media = mockMatchMedia(false);
    const { result } = renderHook(() => useSidebarAutoCollapse());

    expect(result.current.open).toBe(true);
  });

  it("follows the window across the breakpoint", () => {
    media = mockMatchMedia(false);
    const { result } = renderHook(() => useSidebarAutoCollapse());

    media.resize(true);
    expect(result.current.open).toBe(false);
    media.resize(false);
    expect(result.current.open).toBe(true);
  });

  it("lets the collapse control toggle it in between", () => {
    media = mockMatchMedia(true);
    const { result } = renderHook(() => useSidebarAutoCollapse());

    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
  });
});
