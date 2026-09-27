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
  lastRating: string;
}

const ACTIVITY_TYPE_TRANSLATION_KEYS: Record<string, string> = {
  flashcard_deck: "activityTypeFlashcardDeck",
  link: "activityTypeLink",
  pdf: "activityTypePdf",
  quiz: "activityTypeQuiz",
};

const RATING_TRANSLATION_KEYS: Record<string, string> = {
  again: "ratingAgainAction",
  easy: "ratingEasyAction",
  good: "ratingGoodAction",
  hard: "ratingHardAction",
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
  const { t } = useTranslation();

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
        key: "edit",
        label: t("editActivityAction"),
        onSelect: () => onEdit(activity),
      },
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
    <ActionableTableRow actions={actions} onOpen={actions[0].onSelect}>
      <TableCell className="font-medium">{activity.title}</TableCell>
      <TableCell>
        <Badge variant="outline">{t(typeTranslationKey)}</Badge>
      </TableCell>
      <TableCell>
        {reviewState ? (
          <Badge
            variant={
              RATING_BADGE_VARIANTS[reviewState.lastRating] ?? "secondary"
            }
          >
            {t(
              RATING_TRANSLATION_KEYS[reviewState.lastRating] ??
                reviewState.lastRating
            )}
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {reviewState ? format(reviewState.dueDate, "yyyy-MM-dd") : null}
      </TableCell>
    </ActionableTableRow>
  );
}

export default function ActivitiesDataTable({
  activities,
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
      <div className="overflow-hidden rounded-lg border">
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
      </div>
    </TooltipProvider>
  );
}
