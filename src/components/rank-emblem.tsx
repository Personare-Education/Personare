import { useId } from "react";
import type { RankTier } from "@/utils/ranks";

/**
 * A rank's emblem, drawn here (docs/specs/gamification.md §4): each tier
 * its own shape and color, growing with the division -- III the plain
 * shape, II with a star, I with the star and a double outline. Magnum is a
 * crown.
 */

/** Each tier's color, the same in light and dark. */
export const TIER_COLORS: Record<RankTier, string> = {
  bronze: "oklch(0.62 0.12 55)",
  diamond: "oklch(0.7 0.14 230)",
  emerald: "oklch(0.66 0.15 160)",
  gold: "oklch(0.78 0.15 85)",
  iron: "oklch(0.6 0.02 250)",
  magnum: "oklch(0.62 0.2 300)",
  platinum: "oklch(0.74 0.08 195)",
  silver: "oklch(0.8 0.02 250)",
};

/** The tier's color as text: mixed toward the foreground for contrast. */
export function tierTextColor(tier: RankTier): string {
  return `color-mix(in oklch, ${TIER_COLORS[tier]} 72%, var(--foreground))`;
}

const CENTER = 32;

/** A regular polygon's points around the center, the first one on top. */
function polygon(sides: number, radius: number, turn = 0): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = ((index / sides) * 360 - 90 + turn) * (Math.PI / 180);
    const x = CENTER + radius * Math.cos(angle);
    const y = CENTER + radius * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

/** The tier's shape, scaled around the center (1 = the core). */
function TierShape({
  fill,
  scale = 1,
  stroke,
  strokeOpacity,
  strokeWidth,
  tier,
}: {
  fill: string;
  scale?: number;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  tier: RankTier;
}) {
  const shared = {
    fill,
    stroke,
    strokeLinejoin: "round" as const,
    strokeOpacity,
    strokeWidth,
    transform: `translate(${CENTER} ${CENTER}) scale(${scale}) translate(${-CENTER} ${-CENTER})`,
    vectorEffect: "non-scaling-stroke" as const,
  };
  switch (tier) {
    case "iron":
      return <rect height={36} rx={11} width={22} x={21} y={14} {...shared} />;
    case "bronze":
      return <path d="M14 17 H50 L32 51 Z" {...shared} />;
    case "silver":
      return <path d="M32 11 L52 32 L32 53 L12 32 Z" {...shared} />;
    case "gold":
      return <polygon points={polygon(5, 21)} {...shared} />;
    case "platinum":
      return <circle cx={CENTER} cy={CENTER} r={19} {...shared} />;
    case "emerald":
      return <polygon points={polygon(6, 22)} {...shared} />;
    case "diamond":
      return <polygon points={polygon(8, 21, 22.5)} {...shared} />;
    default:
      return (
        <path
          d="M15 44 L18 21 L26.5 31 L32 15 L37.5 31 L46 21 L49 44 Z"
          {...shared}
        />
      );
  }
}

const SPARKLE =
  "M32 25 L33.6 30.4 L39 32 L33.6 33.6 L32 39 L30.4 33.6 L25 32 L30.4 30.4 Z";

interface RankEmblemProps {
  className?: string;
  /** 3, 2 or 1; null for Magnum. */
  division: 1 | 2 | 3 | null;
  /** Its name, for screen readers; left out, the emblem is decoration. */
  label?: string;
  size: number;
  tier: RankTier;
}

export default function RankEmblem({
  className,
  division,
  label,
  size,
  tier,
}: RankEmblemProps) {
  const id = useId();
  const color = TIER_COLORS[tier];
  const light = `color-mix(in oklch, ${color} 62%, white)`;
  const dark = `color-mix(in oklch, ${color} 70%, black)`;
  const isMagnum = tier === "magnum";

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      height={size}
      role={label ? "img" : undefined}
      viewBox="0 0 64 64"
      width={size}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>

      {/* Division I: a double outline of the tier's shape, a solid one and
          a finer, fainter one around it. */}
      {division === 1 ? (
        <g data-part="frame">
          <TierShape
            fill="none"
            scale={1.26}
            stroke={light}
            strokeWidth={2.5}
            tier={tier}
          />
          <TierShape
            fill="none"
            scale={1.44}
            stroke={light}
            strokeOpacity={0.55}
            strokeWidth={1.25}
            tier={tier}
          />
        </g>
      ) : null}

      <TierShape
        fill={`url(#${id}-fill)`}
        stroke={dark}
        strokeWidth={1.5}
        tier={tier}
      />
      {/* A facet's light on the top half, and a sparkle in the middle. */}
      <g opacity={0.35}>
        <clipPath id={`${id}-top`}>
          <rect height={CENTER} width={64} x={0} y={0} />
        </clipPath>
        <g clipPath={`url(#${id}-top)`}>
          <TierShape fill="white" scale={0.72} tier={tier} />
        </g>
      </g>
      {isMagnum ? (
        <rect fill={dark} height={5} rx={1.5} width={34} x={15} y={45} />
      ) : null}
      {/* The star marks divisions II and I; III is the plain shape. */}
      {division === 1 || division === 2 ? (
        <path d={SPARKLE} data-part="sparkle" fill="white" opacity={0.85} />
      ) : null}
    </svg>
  );
}
