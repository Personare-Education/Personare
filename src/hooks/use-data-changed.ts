import { useEffect, useRef } from "react";

/**
 * Reload when the main process says a kind of data changed outside this
 * window, e.g. a program created from Claude through the MCP bridge
 * (docs/specs/mcp-create-program.md AC-6).
 */
export function useDataChanged(topic: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(
    () =>
      window.personare?.onDataChanged?.((changed) => {
        if (changed === topic) {
          onChangeRef.current();
        }
      }),
    [topic]
  );
}
