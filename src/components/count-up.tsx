import { useInView, useMotionValue, useSpring } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

interface CountUpProps {
  className?: string;
  delay?: number;
  direction?: "up" | "down";
  duration?: number;
  /** Formats each frame's value; overrides the default number formatting. */
  format?: (value: number) => string;
  from?: number;
  onEnd?: () => void;
  onStart?: () => void;
  separator?: string;
  startWhen?: boolean;
  to: number;
}

export default function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 2,
  className = "",
  startWhen = true,
  separator = "",
  onStart,
  onEnd,
  format,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? to : from);

  // Changed from React Bits' damping/stiffness pair, whose overdamped spring
  // is still at ~89% of `to` when onEnd fires and takes ~4x `duration` to
  // land. A bounceless spring with this visual duration lands on `to` before
  // `duration`, so onEnd really marks the end of the count.
  const springValue = useSpring(motionValue, {
    bounce: 0,
    visualDuration: duration * 0.45,
  });

  const isInView = useInView(ref, { margin: "0px", once: true });

  const getDecimalPlaces = (num: number): number => {
    const str = num.toString();
    if (str.includes(".")) {
      const [, decimals] = str.split(".");
      if (Number.parseInt(decimals, 10) !== 0) {
        return decimals.length;
      }
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number) => {
      if (format) {
        return format(latest);
      }

      const hasDecimals = maxDecimals > 0;

      const options: Intl.NumberFormatOptions = {
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        useGrouping: !!separator,
      };

      const formattedNumber = Intl.NumberFormat("en-US", options).format(
        latest
      );

      return separator
        ? formattedNumber.replace(/,/g, separator)
        : formattedNumber;
    },
    [format, maxDecimals, separator]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === "down" ? to : from);
    }
  }, [from, to, direction, formatValue]);

  useEffect(() => {
    if (isInView && startWhen) {
      if (typeof onStart === "function") {
        onStart();
      }

      const timeoutId = setTimeout(() => {
        motionValue.set(direction === "down" ? from : to);
      }, delay * 1000);

      const durationTimeoutId = setTimeout(
        () => {
          if (typeof onEnd === "function") {
            onEnd();
          }
        },
        delay * 1000 + duration * 1000
      );

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [
    isInView,
    startWhen,
    motionValue,
    direction,
    from,
    to,
    delay,
    onStart,
    onEnd,
    duration,
  ]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });

    return () => unsubscribe();
  }, [springValue, formatValue]);

  return <span className={className} ref={ref} />;
}
