import { format } from "date-fns";
import {
  ExternalLink,
  FileText,
  Layers,
  ListChecks,
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
  onEdit: (activity: Activity) => void;
  onManageFlashcards: (activity: Activity) => void;
  onManageQuiz: (activity: Activity) => void;
  onOpenLink: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
  onStartReview: (activity: Activity) => void;
  onTakeQuiz: (activity: Activity) => void;
  onViewPdf: (activity: Activity) => void;
  reviewStateByActivityId: Record<string, ActivityReviewState | undefined>;
}

interface ActivityRowProps {
  activity: Activity;
  highlight: ReviewHighlight | undefined;
  onEdit: (activity: Activity) => void;
  onManageFlashcards: (activity: Activity) => void;
  onManageQuiz: (activity: Activity) => void;
  onOpenLink: (activity: Activity) => void;
  onRequestDelete: (activity: Activity) => void;
  onStartReview: (activity: Activity) => void;
  onTakeQuiz: (activity: Activity) => void;
  onViewPdf: (activity: Activity) => void;
  reviewState: ActivityReviewState | undefined;
}

function ActivityRow({
  activity,
  highlight,
  onEdit,
  onManageFlashcards,
  onManageQuiz,
  onOpenLink,
  onRequestDelete,
  onStartReview,
  onTakeQuiz,
  onViewPdf,
  reviewState,
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

    return [
      ...(typeActions[activity.type] ?? []),
      {
        icon: <Pencil />,
        inMenu: true,
        key: "edit",
        label: t("editActivityAction"),
        onSelect: () => onEdit(activity),
      },
      {
        destructive: true,
        icon: <Trash2 />,
        inMenu: true,
        key: "delete",
        label: t("deleteActivityAction"),
        onSelect: () => onRequestDelete(activity),
      },
    ];
  }, [
    activity,
    onEdit,
    onManageFlashcards,
    onManageQuiz,
    onOpenLink,
    onRequestDelete,
    onStartReview,
    onTakeQuiz,
    onViewPdf,
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
      <TableCell className="font-medium">{activity.title}</TableCell>
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

export default function ActivitiesDataTable({
  activities,
  highlightByActivityId = NO_HIGHLIGHTS,
  onEdit,
  onManageFlashcards,
  onManageQuiz,
  onOpenLink,
  onRequestDelete,
  onStartReview,
  onTakeQuiz,
  onViewPdf,
  reviewStateByActivityId,
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
            {activities.map((activity) => (
              <ActivityRow
                activity={activity}
                highlight={highlightByActivityId[activity.id]}
                key={activity.id}
                onEdit={onEdit}
                onManageFlashcards={onManageFlashcards}
                onManageQuiz={onManageQuiz}
                onOpenLink={onOpenLink}
                onRequestDelete={onRequestDelete}
                onStartReview={onStartReview}
                onTakeQuiz={onTakeQuiz}
                onViewPdf={onViewPdf}
                reviewState={reviewStateByActivityId[activity.id]}
              />
            ))}
          </TableBody>
        </Table>
      </ReviewHighlightTableFrame>
    </TooltipProvider>
  );
}
