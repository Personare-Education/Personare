import type { ReactNode } from "react";
import { useStackEntering } from "@/utils/stack-content-reveal";

/**
 * The routed page, held back while a stack push/pop slides the empty panel
 * in, then mounted with a quick fade (src/utils/stack-content-reveal.ts).
 */
export default function StackContent({ children }: { children: ReactNode }) {
  const isEntering = useStackEntering();

  if (isEntering) {
    return null;
  }

  return (
    <div className="fade-in-0 h-full animate-in duration-150">{children}</div>
  );
}
