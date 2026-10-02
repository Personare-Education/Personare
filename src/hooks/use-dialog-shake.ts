import { useCallback, useRef, useState } from "react";

/**
 * A soft sideways shake. `transform` is free for it: the dialog is centered
 * with Tailwind's `translate` property.
 */
const SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-6px)" },
  { transform: "translateX(5px)" },
  { transform: "translateX(-3px)" },
  { transform: "translateX(2px)" },
  { transform: "translateX(0)" },
];

/**
 * A dialog that must not close by accident (a quiz being taken or written):
 * `preventAndShake` cancels the close event (Radix's onInteractOutside or
 * onEscapeKeyDown) and shakes the content softly instead. Through the Web
 * Animations API, apart from the dialog's CSS open animation: swapping that
 * for a CSS shake replayed the open animation after it (a blink).
 */
export function useDialogShake<T extends HTMLElement>() {
  const contentRef = useRef<T>(null);
  const [isShaking, setIsShaking] = useState(false);

  const preventAndShake = useCallback((event: Event) => {
    event.preventDefault();

    const content = contentRef.current;
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!content?.animate || prefersReducedMotion) {
      return;
    }

    setIsShaking(true);
    content
      .animate(SHAKE_KEYFRAMES, { duration: 400, easing: "ease-in-out" })
      .finished.catch(() => undefined)
      .then(() => setIsShaking(false));
  }, []);

  return { contentRef, isShaking, preventAndShake };
}
