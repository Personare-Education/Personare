import { useSyncExternalStore } from "react";

const STACK_TYPES = new Set(["stack-push", "stack-pop"]);

let entering = false;
const listeners = new Set<() => void>();

function setEntering(next: boolean): void {
  if (entering !== next) {
    entering = next;
    for (const listener of listeners) {
      listener();
    }
  }
}

export function isStackEntering(): boolean {
  return entering;
}

export function subscribeStackEntering(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while a stack push/pop slides; the page waits to mount until then. */
export function useStackEntering(): boolean {
  return useSyncExternalStore(subscribeStackEntering, isStackEntering);
}

/**
 * During a stack push/pop (src/utils/stack-transition.ts) only the empty
 * content panel slides; the new page mounts once the slide ends and fades
 * in (src/components/stack-content.tsx). Mounted earlier, it showed up
 * mid-slide over the page it replaces, and rendering it -- a heavy programs
 * grid, as its data arrives -- made the slide stutter.
 *
 * TanStack Router starts the view transition itself and does not hand the
 * ViewTransition back, so this wraps document.startViewTransition. The flag
 * goes up at the start of the update callback: the old page has been
 * captured by then, and the router's own update then renders the empty
 * panel instead of the new page.
 */
export function installStackContentReveal(doc: Document): void {
  if (typeof doc.startViewTransition !== "function") {
    return;
  }

  const start = doc.startViewTransition.bind(doc);

  doc.startViewTransition = ((
    options?: StartViewTransitionOptions | ViewTransitionUpdateCallback
  ) => {
    const isStack =
      typeof options === "object" &&
      (options.types ?? []).some((type) => STACK_TYPES.has(type));
    if (!isStack) {
      return start(options);
    }

    const transition = start({
      ...options,
      update: () => {
        setEntering(true);
        return options.update?.();
      },
    });

    // Skipped or interrupted transitions reject `finished`; the page must
    // mount either way.
    transition.finished.catch(() => undefined).then(() => setEntering(false));

    return transition;
  }) as typeof doc.startViewTransition;
}
