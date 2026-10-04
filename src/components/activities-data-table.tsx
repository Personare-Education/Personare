import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileText,
  Layers,
  ListChecks,
  ListOrdered,
  Lock,
  Pencil,
  Play,
  Repeat,
  Trash2,
} from "lucide-react";
import { type CSSProperties, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { openExternalLink } from "@/actions/shell";
import ActionableTableRow, {
  type RowAction,
} from "@/components/actionable-table-row";
import LockLabel from "@/components/lock-label";
import {
  RATING_LABEL_KEYS,
  RATING_TONES,
  type RatingValue,
} from "@/components/rating-buttons";
import ReviewHighlightChip from "@/components/review-highlight-chip";
import ReviewHighlightTableFrame from "@/components/review-highlight-table-frame";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { resolveEventCalendarLocale } from "@/utils/event-calendar-i18n";
import type { ReviewHighlight } from "@/utils/review-highlight";
import { formatRelativeDue } from "@/utils/review-time";

export interface Activity {
  createdAt: Date;
  filePath: string | null;
  id: string;
  moduleId: string;
  title: string;
  type: string;
  /** How it unlocks (docs/specs/sequences-and-locks.md); "none" when free. */
  unlockMode?: string;
  updatedAt: Date;
  url: string | null;
}

export interface ActivityReviewState {
  dueDate: Date;
  /** Empty until the activity (or, for a deck, any card) is rated. */
  lastRating: string;
}

const ACTIVITY_TYPE_TRANSLATION_KEYS: Record<string, string> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  group: "activityTypeGroup",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

/**
 * The last rating, in the activity's words for every row -- a deck's too
 * -- and tinted in the rating's tone like the rating buttons, never as a
 * primary badge (docs/specs/table-rating-scale.md).
 */
function RatingChip({ rating }: { rating: RatingValue }) {
  const { t } = useTranslation();

  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone)_12%,transparent)] px-2 py-0.5 font-medium text-[0.6875rem] text-foreground"
      style={{ "--tone": RATING_TONES[rating] } as CSSProperties}
    >
      {t(RATING_LABEL_KEYS.activity[rating])}
    </span>
  );
}

interface ActivitiesDataTableProps {
  activities: Activity[];
  /** Pending-review highlight per activity (docs/specs/calendar-module-review-highlight.md). */
  highlightByActivityId?: Record<string, ReviewHighlight | undefined>;
  /** What each locked activity is missing; absent means free (§4 AC-2). */
  lockLabelById?: Record<string, string | undefined>;
  onEdit: (activity: Activity) => void;
  onManageFlashcards: (activity: Activity) => void;
  onManageQuiz: (activity: Activity) => void;
  /** A sequence's manager (docs/specs/sequences-and-locks.md §3 AC-3). */
  onManageSequence?: (activity: Activity) => void;
  /** Moves a row up (-1) or down (1); left out while a search filters (AC-4). */
  onMove?: (activity: Activity, direction: -1 | 1) => void;
  onOpenLink: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
  /** Does a sequence, step by step (docs/specs/sequences-and-locks.md §5). */
  onRunSequence?: (activity: Activity) => void;
  onStartReview: (activity: Activity) => void;
  onTakeQuiz: (activity: Activity) => void;
  /** Opens an activity's unlock rule (docs/specs/sequences-and-locks.md §4). */
  onUnlockRule?: (activity: Activity) => void;
  onViewPdf: (activity: Activity) => void;
  reviewStateByActivityId: Record<string, ActivityReviewState | undefined>;
  /** How many activities each sequence holds. */
  stepCountByGroupId?: Record<string, number | undefined>;
}

interface ActivityRowProps {
  activity: Activity;
  highlight: ReviewHighlight | undefined;
  isFirst: boolean;
  isLast: boolean;
  lockLabel: string | undefined;
  onEdit: (activity: Activity) => void;
  onManageFlashcards: (activity: Activity) => void;
  onManageQuiz: (activity: Activity) => void;
  onManageSequence?: (activity: Activity) => void;
  onMove?: (activity: Activity, direction: -1 | 1) => void;
  onOpenLink: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
  onRunSequence?: (activity: Activity) => void;
  onStartReview: (activity: Activity) => void;
  onTakeQuiz: (activity: Activity) => void;
  onUnlockRule?: (activity: Activity) => void;
  onViewPdf: (activity: Activity) => void;
  reviewState: ActivityReviewState | undefined;
  stepCount: number | undefined;
}

function ActivityRow({
  activity,
  highlight,
  isFirst,
  isLast,
  lockLabel,
  onEdit,
  onManageFlashcards,
  onManageQuiz,
  onManageSequence,
  onMove,
  onOpenLink,
  onRequestDelete,
  onRunSequence,
  onStartReview,
  onTakeQuiz,
  onUnlockRule,
  onViewPdf,
  reviewState,
  stepCount,
}: ActivityRowProps) {
  const { i18n, t } = useTranslation();
  const locale = resolveEventCalendarLocale(i18n.language);

  // The first action is what clicking the row does.
  const actions = useMemo<RowAction[]>(() => {
    const typeActions: Record<string, RowAction[]> = {
      flashcard_deck: [
        {
          icon: <Repeat />,
          key: "start-review",
          label: t("startReviewAction"),
          onSelect: () => onStartReview(activity),
        },
        {
          icon: <Layers />,
          key: "manage-flashcards",
          label: t("manageFlashcardsAction"),
          onSelect: () => onManageFlashcards(activity),
        },
      ],
      group: [
        // Something to do first, when there is (§5 AC-1).
        ...(stepCount && onRunSequence
          ? [
              {
                icon: <Play />,
                key: "run-sequence",
                label: t("runSequenceAction"),
                onSelect: () => onRunSequence(activity),
              },
            ]
          : []),
        {
          icon: <ListOrdered />,
          key: "view-sequence",
          label: t("viewSequenceAction"),
          onSelect: () => onManageSequence?.(activity),
        },
      ],
      link: [
        {
          icon: <ExternalLink />,
          key: "open-url",
          label: t("openActivityUrlAction"),
          onSelect: () => {
            if (activity.url) {
              openExternalLink(activity.url);
            }
            onOpenLink(activity);
          },
        },
      ],
      pdf: [
        {
          icon: <FileText />,
          key: "view-pdf",
          label: t("viewPdfAction"),
          onSelect: () => onViewPdf(activity),
        },
      ],
      quiz: [
        {
          icon: <Play />,
          key: "take-quiz",
          label: t("takeQuizAction"),
          onSelect: () => onTakeQuiz(activity),
        },
        {
          icon: <ListChecks />,
          key: "manage-quiz",
          label: t("manageQuizQuestionsAction"),
          onSelect: () => onManageQuiz(activity),
        },
      ],
    };

    // Up and down, but not past the ends (§3 AC-4).
    const moveActions: RowAction[] = [];
    if (onMove && !isFirst) {
      moveActions.push({
        icon: <ArrowUp />,
        key: "move-up",
        label: t("moveUpAction"),
        onSelect: () => onMove(activity, -1),
      });
    }
    if (onMove && !isLast) {
      moveActions.push({
        icon: <ArrowDown />,
        key: "move-down",
        label: t("moveDownAction"),
        onSelect: () => onMove(activity, 1),
      });
    }

    const unlockRuleAction: RowAction[] = onUnlockRule
      ? [
          {
            icon: <Lock />,
            key: "unlock-rule",
            label: t("unlockRuleAction"),
            onSelect: () => onUnlockRule(activity),
          },
        ]
      : [];

    return [
      // A locked activity does not open: its rule leads instead (§4 AC-3).
      ...(lockLabel ? [] : (typeActions[activity.type] ?? [])),
      ...(lockLabel ? unlockRuleAction : []),
      {
        icon: <Pencil />,
        key: "edit",
        label: t("editActivityAction"),
        onSelect: () => onEdit(activity),
      },
      ...(lockLabel ? [] : unlockRuleAction),
      ...moveActions,
      {
        destructive: true,
        icon: <Trash2 />,
        key: "delete",
        label: t("deleteActivityAction"),
        onSelect: () => onRequestDelete(activity),
      },
    ];
  }, [
    activity,
    isFirst,
    isLast,
    lockLabel,
    onEdit,
    onManageFlashcards,
    onManageQuiz,
    onManageSequence,
    onMove,
    onOpenLink,
    onRequestDelete,
    onRunSequence,
    onStartReview,
    onTakeQuiz,
    onUnlockRule,
    onViewPdf,
    stepCount,
    t,
  ]);

  const typeTranslationKey =
    ACTIVITY_TYPE_TRANSLATION_KEYS[activity.type] ?? activity.type;

  return (
    <ActionableTableRow
      actions={actions}
      highlight={highlight}
      onOpen={actions[0].onSelect}
      rowId={activity.id}
    >
      <TableCell className="font-medium">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {activity.title}
          {/* What a sequence holds, beside its name (§3 AC-3). */}
          {activity.type === "group" ? (
            <span className="font-normal text-muted-foreground text-xs tabular-nums">
              {t("sequenceStepCount", { count: stepCount ?? 0 })}
            </span>
          ) : null}
          {lockLabel ? <LockLabel label={lockLabel} /> : null}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{t(typeTranslationKey)}</Badge>
      </TableCell>
      <TableCell>
        {reviewState?.lastRating && reviewState.lastRating in RATING_TONES ? (
          <RatingChip rating={reviewState.lastRating as RatingValue} />
        ) : (
          // Never blank (docs/specs/layout-tables.md AC-2).
          <span className="text-muted-foreground text-xs">
            {t("activityNotRatedYetLabel")}
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {/* The review chip goes where the date would (AC-3). */}
        {highlight ? <ReviewHighlightChip highlight={highlight} /> : null}
        {!highlight && reviewState ? (
          <time
            dateTime={format(reviewState.dueDate, "yyyy-MM-dd")}
            title={format(reviewState.dueDate, "PPPP", { locale })}
          >
            {formatRelativeDue(reviewState.dueDate, new Date(), t)}
          </time>
        ) : null}
      </TableCell>
    </ActionableTableRow>
  );
}

const NO_HIGHLIGHTS: Record<string, ReviewHighlight | undefined> = {};
const NO_COUNTS: Record<string, number | undefined> = {};
const NO_LOCKS: Record<string, string | undefined> = {};

export default function ActivitiesDataTable({
  activities,
  highlightByActivityId = NO_HIGHLIGHTS,
  lockLabelById = NO_LOCKS,
  onEdit,
  onManageFlashcards,
  onManageQuiz,
  onManageSequence,
  onMove,
  onOpenLink,
  onRequestDelete,
  onRunSequence,
  onStartReview,
  onTakeQuiz,
  onUnlockRule,
  onViewPdf,
  reviewStateByActivityId,
  stepCountByGroupId = NO_COUNTS,
}: ActivitiesDataTableProps) {
  const { t } = useTranslation();

  if (activities.length === 0) {
    return <p>{t("activitiesTableEmptyMessage")}</p>;
  }

  return (
    <TooltipProvider>
      <ReviewHighlightTableFrame highlightById={highlightByActivityId}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("activityTitleLabel")}</TableHead>
              <TableHead>{t("activityTypeLabel")}</TableHead>
              <TableHead>{t("activityReviewStateColumnLabel")}</TableHead>
              <TableHead>{t("activityNextReviewColumnLabel")}</TableHead>
              <TableHead>{t("actionsColumnLabel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity, index) => (
              <ActivityRow
                activity={activity}
                highlight={highlightByActivityId[activity.id]}
                isFirst={index === 0}
                isLast={index === activities.length - 1}
                key={activity.id}
                lockLabel={lockLabelById[activity.id]}
                onEdit={onEdit}
                onManageFlashcards={onManageFlashcards}
                onManageQuiz={onManageQuiz}
                onManageSequence={onManageSequence}
                onMove={onMove}
                onOpenLink={onOpenLink}
                onRequestDelete={onRequestDelete}
                onRunSequence={onRunSequence}
                onStartReview={onStartReview}
                onTakeQuiz={onTakeQuiz}
                onUnlockRule={onUnlockRule}
                onViewPdf={onViewPdf}
                reviewState={reviewStateByActivityId[activity.id]}
                stepCount={stepCountByGroupId[activity.id]}
              />
            ))}
          </TableBody>
        </Table>
      </ReviewHighlightTableFrame>
    </TooltipProvider>
  );
}
