import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getPointsSummary } from "@/actions/points";
import RankEmblem, {
  TIER_COLORS,
  tierTextColor,
} from "@/components/rank-emblem";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { onPointsChanged } from "@/utils/points-events";
import { RANK_STEPS, type RankStep, type RankTier } from "@/utils/ranks";
import { onReviewCompleted } from "@/utils/review-events";
import { playVictory } from "@/utils/sounds";
import { cn } from "@/utils/tailwind";

type PointsSummary = Awaited<ReturnType<typeof getPointsSummary>>;

const DIVISION_NUMERALS = { 1: "I", 2: "II", 3: "III" } as const;

/** The tiers with divisions, left to right, for the grid of every rank. */
const GRID_TIERS: RankTier[] = [
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "emerald",
  "diamond",
];

/** How long a new tier is celebrated (§4 AC-3). */
const CELEBRATE_MS = 1600;

/** "Prata II", or "Magnum". */
function useRankName(): (step: RankStep) => string {
  const { t } = useTranslation();
  return (step) => {
    const tier = t(`rankTier_${step.tier}`);
    return step.division === null
      ? tier
      : `${tier} ${DIVISION_NUMERALS[step.division]}`;
  };
}

function progressOf(summary: PointsSummary): number {
  const { end, start } = summary.rank;
  return end === null
    ? 100
    : Math.round(((summary.points - start) / (end - start)) * 100);
}

/**
 * The season's step in the sidebar, with the way to the next, and the
 * Ranking behind it (docs/specs/gamification.md §4 AC-2); says when the
 * step changes (AC-3).
 */
export function RankWidget() {
  const { t } = useTranslation();
  const rankName = useRankName();
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  // The step as last loaded; null until the first load, which says nothing.
  const lastStepRef = useRef<RankStep | null>(null);

  const refresh = useCallback(() => {
    getPointsSummary()
      .then((loaded) => {
        const before = lastStepRef.current;
        const after = loaded.rank;
        lastStepRef.current = after;
        setSummary(loaded);
        if (!before || before.step === after.step) {
          return;
        }
        const name = rankName(after);
        if (after.step < before.step) {
          toast(t("rankDownMessage", { rank: name }));
        } else if (after.tier === before.tier) {
          toast(t("rankUpMessage", { rank: name }));
        } else {
          toast(t("rankTierUpMessage", { rank: name }));
          playVictory();
          setIsCelebrating(true);
        }
      })
      .catch(() => undefined);
  }, [rankName, t]);

  useEffect(() => {
    refresh();
    const stopReviews = onReviewCompleted(refresh);
    const stopPoints = onPointsChanged(refresh);
    return () => {
      stopReviews();
      stopPoints();
    };
  }, [refresh]);

  useEffect(() => {
    if (!isCelebrating) {
      return;
    }
    const timeout = setTimeout(() => setIsCelebrating(false), CELEBRATE_MS);
    return () => clearTimeout(timeout);
  }, [isCelebrating]);

  const handleOpen = useCallback(() => setIsOpen(true), []);

  if (!summary) {
    return null;
  }
  const name = rankName(summary.rank);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label={t("rankButtonLabel", { rank: name })}
          className="h-auto flex-col items-stretch gap-1 py-1.5"
          onClick={handleOpen}
        >
          <span className="flex items-center gap-2">
            <span
              className="relative flex size-4 shrink-0 items-center justify-center"
              data-celebrating={isCelebrating || undefined}
            >
              <RankEmblem
                className={cn("shrink-0", isCelebrating && "rank-celebrate")}
                division={summary.rank.division}
                size={20}
                tier={summary.rank.tier}
              />
            </span>
            <span className="truncate">{name}</span>
          </span>
          <Progress
            aria-label={t("rankProgressLabel")}
            className="h-1 group-data-[collapsible=icon]:hidden"
            value={progressOf(summary)}
          />
        </SidebarMenuButton>
        <RankingDialog
          name={name}
          onOpenChange={setIsOpen}
          open={isOpen}
          summary={summary}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

interface RankingDialogProps {
  name: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  summary: PointsSummary;
}

/** "T4 2026" from "2026-Q4". */
function useSeasonName(): (season: string) => string {
  const { t } = useTranslation();
  return (season) => {
    const [year, quarter] = season.split("-Q");
    return t("rankSeasonName", { quarter, year });
  };
}

/** A gain or a loss: "+15", "−2". */
function signed(amount: number): string {
  return amount > 0 ? `+${amount}` : `−${Math.abs(amount)}`;
}

/**
 * The Ranking (§4 AC-2, AC-4), in two tabs: My rank -- the emblem in the
 * middle, the season's points, the progress in the step and the history --
 * and every rank, laid out as a grid.
 */
function RankingDialog({
  name,
  onOpenChange,
  open,
  summary,
}: RankingDialogProps) {
  const { t } = useTranslation();
  const seasonName = useSeasonName();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("rankingTitle")}</DialogTitle>
          <DialogDescription>
            {t("rankSeasonLabel", { season: seasonName(summary.season.id) })}
          </DialogDescription>
        </DialogHeader>
        <Tabs className="min-h-0" defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">{t("rankMyRankTab")}</TabsTrigger>
            <TabsTrigger value="all">{t("rankAllRanksTab")}</TabsTrigger>
          </TabsList>
          <TabsContent
            className="-mx-1 min-h-0 overflow-y-auto px-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
            value="mine"
          >
            <MyRank name={name} summary={summary} />
          </TabsContent>
          <TabsContent
            className="-mx-1 min-h-0 overflow-auto px-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
            value="all"
          >
            <AllRanks summary={summary} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** The emblem in the middle, the points and the way to the next step. */
function MyRank({ name, summary }: { name: string; summary: PointsSummary }) {
  const { i18n, t } = useTranslation();
  const rankName = useRankName();
  const seasonName = useSeasonName();
  const { rank } = summary;
  const next = RANK_STEPS[rank.step];
  const timeFormat = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });

  return (
    <div className="flex flex-col gap-5 pt-2">
      <section
        className="flex flex-col items-center gap-3 rounded-xl border px-6 pt-6 pb-5"
        style={{
          background: `radial-gradient(120% 90% at 50% 0%, color-mix(in oklch, ${TIER_COLORS[rank.tier]} 22%, transparent), transparent 70%)`,
        }}
      >
        <RankEmblem
          division={rank.division}
          label={name}
          size={112}
          tier={rank.tier}
        />
        <h3
          className="font-semibold text-3xl uppercase tracking-[0.08em]"
          style={{ color: tierTextColor(rank.tier) }}
        >
          {name}
        </h3>
        <div className="flex w-full flex-col items-center gap-1 border-t pt-3">
          <span className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
            {t("rankSeasonPointsLabel")}
          </span>
          <span className="font-semibold text-2xl tabular-nums">
            {t("rankPoints", { count: summary.points })}
          </span>
        </div>
        <div className="flex w-full flex-col gap-1.5">
          <Progress value={progressOf(summary)} />
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{t("rankProgressTitle")}</span>
            <span className="text-muted-foreground tabular-nums">
              {rank.end === null
                ? summary.points
                : `${summary.points - rank.start}/${rank.end - rank.start}`}
            </span>
          </div>
          <span className="text-muted-foreground text-xs">
            {summary.toNext === null || !next
              ? t("rankTopMessage")
              : t("rankToNext", {
                  count: summary.toNext,
                  rank: rankName(next),
                })}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">{t("rankRecentTitle")}</h3>
        {summary.recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("rankRecentEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {summary.recent.map((event, index) => (
              <li
                className="flex items-center justify-between gap-3 py-1.5"
                // biome-ignore lint/suspicious/noArrayIndexKey: the list is reloaded whole and never reordered.
                key={index}
              >
                <span>{t(`rankKind_${event.kind}`)}</span>
                <span className="flex items-center gap-3 text-muted-foreground text-xs tabular-nums">
                  {timeFormat.format(event.createdAt)}
                  <span
                    className={cn(
                      "w-10 text-end font-semibold text-sm",
                      event.amount > 0
                        ? "text-success-text"
                        : "text-destructive-text"
                    )}
                  >
                    {signed(event.amount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.pastSeasons.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-sm">{t("rankPastSeasonsTitle")}</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {summary.pastSeasons.map((season) => {
              const step = RANK_STEPS[season.step - 1];
              return (
                <li
                  className="flex items-center justify-between gap-3"
                  key={season.season}
                >
                  <span>{seasonName(season.season)}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <RankEmblem
                      division={step.division}
                      size={20}
                      tier={step.tier}
                    />
                    {rankName(step)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const ROW_NUMERALS = ["I", "II", "III"];

/**
 * Every rank (§4 AC-2): a column per tier, its divisions top to bottom from
 * I to III, and Magnum on its own at the end. The current step stands out;
 * the ones still to reach are dimmed. In the list's order, a screen reader
 * hears them from the bottom up.
 */
function AllRanks({ summary }: { summary: PointsSummary }) {
  const { t } = useTranslation();
  const rankName = useRankName();

  return (
    <div className="flex flex-col gap-2 pt-3">
      <div
        aria-hidden="true"
        className="grid grid-cols-[1.5rem_repeat(8,minmax(3.25rem,1fr))] gap-x-1 text-center text-[0.65rem] text-muted-foreground uppercase tracking-[0.08em]"
      >
        <span />
        {[...GRID_TIERS, "magnum" as const].map((tier) => (
          <span className="truncate" key={tier}>
            {t(`rankTier_${tier}`)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-1">
        <div
          aria-hidden="true"
          className="grid grid-rows-3 gap-y-2 text-[0.65rem] text-muted-foreground"
        >
          {ROW_NUMERALS.map((numeral) => (
            <span className="flex items-center" key={numeral}>
              {numeral}
            </span>
          ))}
        </div>
        <ol
          aria-label={t("rankLadderTitle")}
          className="grid grid-cols-[repeat(8,minmax(3.25rem,1fr))] grid-rows-3 gap-x-1 gap-y-2"
        >
          {RANK_STEPS.map((step) => {
            const isCurrent = step.step === summary.rank.step;
            const reached = step.step <= summary.rank.step;
            const isMagnum = step.division === null;
            return (
              <li
                aria-current={isCurrent ? "step" : undefined}
                aria-label={rankName(step)}
                className={cn(
                  "flex items-center justify-center rounded-lg py-1.5",
                  isCurrent && "bg-muted ring-2 ring-inset",
                  !reached && "opacity-55"
                )}
                data-reached={reached}
                key={step.step}
                style={{
                  gridColumn: String(
                    isMagnum ? 8 : GRID_TIERS.indexOf(step.tier) + 1
                  ),
                  gridRow: isMagnum ? "1 / span 3" : String(step.division),
                  ...(isCurrent
                    ? { ["--tw-ring-color" as string]: TIER_COLORS[step.tier] }
                    : {}),
                }}
                title={t("rankStartsAt", { count: step.start })}
              >
                <RankEmblem
                  division={step.division}
                  size={isMagnum ? 64 : 46}
                  tier={step.tier}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
