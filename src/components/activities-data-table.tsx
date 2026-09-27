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
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { openExternalLink } from "@/actions/shell";
import ActionIconButton from "@/components/action-icon-button";
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

  const handleEditClick = useCallback(() => {
    onEdit(activity);
  }, [onEdit, activity]);

  const handleDeleteClick = useCallback(() => {
    onRequestDelete(activity);
  }, [onRequestDelete, activity]);

  const handleOpenUrlClick = useCallback(() => {
    if (activity.url) {
      openExternalLink(activity.url);
    }
    onOpenLink(activity);
  }, [activity, onOpenLink]);

  const handleViewPdfClick = useCallback(() => {
    onViewPdf(activity);
  }, [onViewPdf, activity]);

  const handleManageQuizClick = useCallback(() => {
    onManageQuiz(activity);
  }, [onManageQuiz, activity]);

  const handleTakeQuizClick = useCallback(() => {
    onTakeQuiz(activity);
  }, [onTakeQuiz, activity]);

  const handleManageFlashcardsClick = useCallback(() => {
    onManageFlashcards(activity);
  }, [onManageFlashcards, activity]);

  const handleStartReviewClick = useCallback(() => {
    onStartReview(activity);
  }, [onStartReview, activity]);

  const typeTranslationKey =
    ACTIVITY_TYPE_TRANSLATION_KEYS[activity.type] ?? activity.type;

  return (
    <TableRow>
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
      <TableCell>
        <div className="flex items-center gap-1">
          {activity.type === "link" && (
            <ActionIconButton
              label={t("openActivityUrlAction")}
              onClick={handleOpenUrlClick}
            >
              <ExternalLink />
            </ActionIconButton>
          )}
          {activity.type === "pdf" && (
            <ActionIconButton
              label={t("viewPdfAction")}
              onClick={handleViewPdfClick}
            >
              <FileText />
            </ActionIconButton>
          )}
          {activity.type === "quiz" && (
            <ActionIconButton
              label={t("manageQuizQuestionsAction")}
              onClick={handleManageQuizClick}
            >
              <ListChecks />
            </ActionIconButton>
          )}
          {activity.type === "quiz" && (
            <ActionIconButton
              label={t("takeQuizAction")}
              onClick={handleTakeQuizClick}
            >
              <Play />
            </ActionIconButton>
          )}
          {activity.type === "flashcard_deck" && (
            <ActionIconButton
              label={t("manageFlashcardsAction")}
              onClick={handleManageFlashcardsClick}
            >
              <Layers />
            </ActionIconButton>
          )}
          {activity.type === "flashcard_deck" && (
            <ActionIconButton
              label={t("startReviewAction")}
              onClick={handleStartReviewClick}
            >
              <Repeat />
            </ActionIconButton>
          )}
          <ActionIconButton
            label={t("editActivityAction")}
            onClick={handleEditClick}
          >
            <Pencil />
          </ActionIconButton>
          <ActionIconButton
            label={t("deleteActivityAction")}
            onClick={handleDeleteClick}
          >
            <Trash2 />
          </ActionIconButton>
        </div>
      </TableCell>
    </TableRow>
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
