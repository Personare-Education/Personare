/**
 * The ladder (docs/specs/gamification.md §4): 7 tiers of 3 divisions
 * (III, II, I), each division wider than the tier's below, then Magnum.
 * And the seasons, by quarter.
 */

export type RankTier =
  | "bronze"
  | "diamond"
  | "emerald"
  | "gold"
  | "iron"
  | "magnum"
  | "platinum"
  | "silver";

/** Each tier's division size, from the bottom. */
const TIERS: { size: number; tier: RankTier }[] = [
  { size: 100, tier: "iron" },
  { size: 150, tier: "bronze" },
  { size: 200, tier: "silver" },
  { size: 300, tier: "gold" },
  { size: 400, tier: "platinum" },
  { size: 500, tier: "emerald" },
  { size: 700, tier: "diamond" },
];

export interface RankStep {
  /** 3, 2 or 1; null for Magnum. */
  division: 1 | 2 | 3 | null;
  /** Where the next step starts; null at the top. */
  end: number | null;
  start: number;
  /** 1 (Iron III) to 22 (Magnum). */
  step: number;
  tier: RankTier;
}

function buildSteps(): RankStep[] {
  const steps: RankStep[] = [];
  let start = 0;
  for (const { size, tier } of TIERS) {
    for (const division of [3, 2, 1] as const) {
      steps.push({
        division,
        end: start + size,
        start,
        step: steps.length + 1,
        tier,
      });
      start += size;
    }
  }
  steps.push({
    division: null,
    end: null,
    start,
    step: steps.length + 1,
    tier: "magnum",
  });
  return steps;
}

export const RANK_STEPS: readonly RankStep[] = buildSteps();

export function rankOf(points: number): RankStep {
  return RANK_STEPS.findLast((step) => points >= step.start) ?? RANK_STEPS[0];
}

/** How many steps a new season starts below where the last one ended. */
const SEASON_DROP_STEPS = 6;

/** The new season's points: the start of the step 6 below, at least Iron III. */
export function seasonStartPoints(finalPoints: number): number {
  const target = Math.max(1, rankOf(finalPoints).step - SEASON_DROP_STEPS);
  return RANK_STEPS[target - 1].start;
}

export interface Season {
  end: Date;
  /** "2026-Q4". */
  id: string;
  start: Date;
}

/** The quarter a date falls in, by the local calendar. */
export function seasonOf(date: Date): Season {
  const quarter = Math.floor(date.getMonth() / 3);
  return {
    end: new Date(date.getFullYear(), quarter * 3 + 3, 1),
    id: `${date.getFullYear()}-Q${quarter + 1}`,
    start: new Date(date.getFullYear(), quarter * 3, 1),
  };
}
