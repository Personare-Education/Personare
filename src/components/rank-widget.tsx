import { Crown, Gem, type LucideIcon, Medal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getPointsSummary } from "@/actions/points";
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
import { onPointsChanged } from "@/utils/points-events";
import { RANK_STEPS, type RankStep, type RankTier } from "@/utils/ranks";
import { onReviewCompleted } from "@/utils/review-events";
import { playVictory } from "@/utils/sounds";
import { cn } from "@/utils/tailwind";

type PointsSummary = Awaited<ReturnType<typeof getPointsSummary>>;

/** Each tier's color, the same in light and dark. */
const TIER_COLORS: Record<RankTier, string> = {
  bronze: "oklch(0.62 0.12 55)",
  diamond: "oklch(0.72 0.13 230)",
  emerald: "oklch(0.66 0.15 160)",
  gold: "oklch(0.78 0.15 85)",
  iron: "oklch(0.6 0.02 250)",
  magnum: "oklch(0.62 0.2 300)",
  platinum: "oklch(0.74 0.08 195)",
  silver: "oklch(0.75 0.02 250)",
};

const TIER_ICONS: Record<RankTier, LucideIcon> = {
  bronze: Medal,
  diamond: Gem,
  emerald: Gem,
  gold: Medal,
  iron: Medal,
  magnum: Crown,
  platinum: Medal,
  silver: Medal,
};

const DIVISION_NUMERALS = { 1: "I", 2: "II", 3: "III" } as const;

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

function RankIcon({ className, tier }: { className?: string; tier: RankTier }) {
  const Icon = TIER_ICONS[tier];
  return (
    <Icon
      aria-hidden="true"
      className={className}
      style={{ color: TIER_COLORS[tier] }}
    />
  );
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
              <RankIcon
                className={cn("size-4", isCelebrating && "rank-celebrate")}
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
 * The Ranking (§4 AC-2, AC-4): the step and the season's points, the
 * whole ladder with the current step, the latest gains and losses, and the
 * seasons gone by.
 */
function RankingDialog({
  name,
  onOpenChange,
  open,
  summary,
}: RankingDialogProps) {
  const { i18n, t } = useTranslation();
  const rankName = useRankName();
  const seasonName = useSeasonName();
  const timeFormat = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
  const next = RANK_STEPS[summary.rank.step];
  // Opens with the current step in view, wherever it is on the ladder.
  const currentRef = useCallback((item: HTMLLIElement | null) => {
    // Only the ladder scrolls to it, never the rest of the Ranking.
    const ladder = item?.parentElement;
    if (item && ladder) {
      ladder.scrollTop =
        item.offsetTop - ladder.offsetTop - ladder.clientHeight / 2;
    }
  }, []);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("rankingTitle")}</DialogTitle>
          <DialogDescription>
            {t("rankSeasonLabel", { season: seasonName(summary.season.id) })}
          </DialogDescription>
        </DialogHeader>
        {/* Side by side, each column scrolls on its own; stacked on a narrow
            window, the whole Ranking scrolls. */}
        <div className="-mx-1 grid min-h-0 gap-6 overflow-y-auto px-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] sm:grid-cols-[minmax(0,1fr)_14rem] sm:grid-rows-[minmax(0,1fr)] sm:overflow-hidden">
          <div className="flex flex-col gap-5 sm:min-h-0 sm:overflow-y-auto">
            <div className="flex items-center gap-3">
              <RankIcon className="size-10" tier={summary.rank.tier} />
              <div className="flex flex-col">
                <span className="font-medium font-serif text-2xl">{name}</span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {t("rankPoints", { count: summary.points })}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Progress value={progressOf(summary)} />
              <span className="text-muted-foreground text-xs">
                {summary.toNext === null || !next
                  ? t("rankTopMessage")
                  : t("rankToNext", {
                      count: summary.toNext,
                      rank: rankName(next),
                    })}
              </span>
            </div>
            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-sm">{t("rankRecentTitle")}</h3>
              {summary.recent.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("rankRecentEmpty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {summary.recent.map((event, index) => (
                    <li
                      className="flex items-center justify-between gap-3"
                      // biome-ignore lint/suspicious/noArrayIndexKey: the list is reloaded whole and never reordered.
                      key={index}
                    >
                      <span>{t(`rankKind_${event.kind}`)}</span>
                      <span className="flex items-center gap-3 text-muted-foreground text-xs tabular-nums">
                        {timeFormat.format(event.createdAt)}
                        <span
                          className={cn(
                            "w-10 text-right font-medium text-sm",
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
                <h3 className="font-medium text-sm">
                  {t("rankPastSeasonsTitle")}
                </h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {summary.pastSeasons.map((season) => {
                    const step = RANK_STEPS[season.step - 1];
                    return (
                      <li
                        className="flex items-center justify-between gap-3"
                        key={season.season}
                      >
                        <span>{seasonName(season.season)}</span>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <RankIcon className="size-3.5" tier={step.tier} />
                          {rankName(step)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
          <ol
            aria-label={t("rankLadderTitle")}
            className="relative flex flex-col-reverse gap-0.5 text-sm [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] sm:min-h-0 sm:overflow-y-auto sm:pe-1"
          >
            {RANK_STEPS.map((step) => {
              const isCurrent = step.step === summary.rank.step;
              return (
                <li
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-0.5",
                    isCurrent
                      ? "bg-muted font-medium"
                      : step.step > summary.rank.step && "text-muted-foreground"
                  )}
                  key={step.step}
                  ref={isCurrent ? currentRef : undefined}
                >
                  <span className="flex items-center gap-2">
                    <RankIcon className="size-3.5" tier={step.tier} />
                    {rankName(step)}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {step.start}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
