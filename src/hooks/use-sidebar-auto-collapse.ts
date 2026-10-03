import { useCallback, useEffect, useState } from "react";

const NARROW_QUERY = "(max-width: 1023px)";

function isNarrow(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(NARROW_QUERY).matches
  );
}

/**
 * The sidebar's open state for `SidebarProvider`
 * (docs/specs/audit-a11y.md AC-5): collapsed to its icons below 1024px,
 * open above it. Crossing the breakpoint resets it; in between, the
 * collapse control still toggles it.
 */
export function useSidebarAutoCollapse() {
  const [open, setOpen] = useState(() => !isNarrow());

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(NARROW_QUERY);
    const handleChange = (event: { matches: boolean }) =>
      setOpen(!event.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const onOpenChange = useCallback((next: boolean) => setOpen(next), []);

  return { onOpenChange, open };
}
