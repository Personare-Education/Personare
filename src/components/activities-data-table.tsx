import type { VariantProps } from "class-variance-authority";
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
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { openExternalLink } from "@/actions/shell";
import ActionableTableRow, {
  type RowAction,
} from "@/components/actionable-table-row";
import {
  RATING_LABEL_KEYS,
  type RatingScale,
  type RatingValue,
} from "@/components/rating-buttons";
import ReviewHighlightChip from "@/components/review-highlight-chip";
import ReviewHighlightTableFrame from "@/components/review-highlight-table-frame";
import { Badge, type badgeVariants } from "@/components/ui/badge";
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
  /** Whose words the rating takes: a deck's are the flashcards'. */
  scale?: RatingScale;
}

const ACTIVITY_TYPE_TRANSLATION_KEYS: Record<string, string> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const RATING_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  again: "destructive",
  easy: "default",
  good: "secondary",
  hard: "outline",
};

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
        {reviewState?.lastRating ? (
          <Badge
            variant={
              RATING_BADGE_VARIANTS[reviewState.lastRating] ?? "secondary"
            }
          >
            {/* A whole activity's words, or a deck's flashcard words
                (docs/specs/rating-clarity.md AC-2, layout-tables.md AC-1). */}
            {t(
              RATING_LABEL_KEYS[reviewState.scale ?? "activity"][
                reviewState.lastRating as RatingValue
              ] ?? reviewState.lastRating
            )}
          </Badge>
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
