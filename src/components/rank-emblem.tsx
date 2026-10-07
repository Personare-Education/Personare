import { useId } from "react";
import type { RankTier } from "@/utils/ranks";

/**
 * A rank's emblem, drawn here (docs/specs/gamification.md §4): each tier
 * its own shape and color, and a frame that grows with the division --
 * III plain, II with brackets, I fully framed. Magnum is a crown in rays.
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
  strokeWidth,
  tier,
}: {
  fill: string;
  scale?: number;
  stroke?: string;
  strokeWidth?: number;
  tier: RankTier;
}) {
  const shared = {
    fill,
    stroke,
    strokeLinejoin: "round" as const,
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

/** Magnum's twelve rays, evenly around it. */
const RAY_ANGLES = Array.from(
  { length: 12 },
  (_, index) => (index / 12) * Math.PI * 2
);

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

      {/* Magnum's rays. */}
      {isMagnum
        ? RAY_ANGLES.map((angle) => (
            <line
              key={angle}
              stroke={light}
              strokeLinecap="round"
              strokeOpacity={0.7}
              strokeWidth={2}
              x1={CENTER + 25 * Math.cos(angle)}
              x2={CENTER + 30 * Math.cos(angle)}
              y1={CENTER + 25 * Math.sin(angle)}
              y2={CENTER + 30 * Math.sin(angle)}
            />
          ))
        : null}

      {/* Division I: a full frame of the tier's shape, and a spark on top. */}
      {division === 1 ? (
        <>
          <TierShape
            fill="none"
            scale={1.32}
            stroke={light}
            strokeWidth={2.5}
            tier={tier}
          />
          <path d="M32 0.5 L34 4 L32 7.5 L30 4 Z" fill={light} />
        </>
      ) : null}

      {/* Division II: brackets on both sides. */}
      {division === 2 ? (
        <g fill="none" stroke={light} strokeLinecap="round" strokeWidth={2.5}>
          <path d="M9 18 Q3 32 9 46" />
          <path d="M55 18 Q61 32 55 46" />
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
      ) : (
        <path d={SPARKLE} fill="white" opacity={0.85} />
      )}
    </svg>
  );
}
