// biome-ignore-all lint/style/useFilenamingConvention: TanStack Router file-based routing requires the "$paramName" filename convention for dynamic route segments.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useTranslation } from "react-i18next";
import {
  createActivity,
  listActivities,
  restoreActivity,
  softDeleteActivity,
  updateActivity,
} from "@/actions/activities";
import { listModules } from "@/actions/modules";
import { listPrograms } from "@/actions/programs";
import { createQuizWithQuestions } from "@/actions/quiz";
import {
  armPendingActivityRating,
  listActivityReviewState,
} from "@/actions/review";
import ActivitiesDataTable, {
  type Activity,
  type ActivityReviewState,
} from "@/components/activities-data-table";
import ActivityDifficultyDialog from "@/components/activity-difficulty-dialog";
import ActivityFormDialog from "@/components/activity-form-dialog";
import DeleteActivityDialog from "@/components/delete-activity-dialog";
import FlashcardManagerDialog from "@/components/flashcard-manager-dialog";
import { ActivitiesEmptyState } from "@/components/onboarding-empty-states";
import QuizQuestionManagerDialog from "@/components/quiz-question-manager-dialog";
import QuizRunnerDialog from "@/components/quiz-runner-dialog";
import ReviewSessionDialog from "@/components/review-session-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRateOnReturn } from "@/hooks/use-rate-on-return";
import { useReviewSchedule } from "@/hooks/use-review-schedule";
import {
  type ActivityFollowUp,
  followUpForCreatedActivity,
} from "@/utils/activity-follow-up";
import type { ParsedQuizQuestion } from "@/utils/quiz-markdown";
import {
  getFocusedActivityIds,
  type ReviewHighlight,
  summarizeReviewUrgency,
  toReviewHighlight,
} from "@/utils/review-highlight";
import { showUndoToast } from "@/utils/undo-toast";

function ModuleActivitiesPage() {
  const { t } = useTranslation();
  const { moduleId, programId } = Route.useParams();
  const { focusDate } = Route.useSearch();
  const { refresh: refreshSchedule, rows: scheduleRows } = useReviewSchedule();
  const [activities, setActivities] = useState<Activity[]>([]);
  // The empty state waits for the first load, so it does not flash by.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [programName, setProgramName] = useState("");
  // The program's color, for the flashcards (editor and review).
  const [programColor, setProgramColor] = useState<string | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [reviewStateByActivityId, setReviewStateByActivityId] = useState<
    Record<string, ActivityReviewState | undefined>
  >({});
  const [, startTransition] = useTransition();
  const [formActivity, setFormActivity] = useState<Activity | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activityPendingDelete, setActivityPendingDelete] =
    useState<Activity | null>(null);
  const [activityBeingManaged, setActivityBeingManaged] =
    useState<Activity | null>(null);
  const [activityTakingQuiz, setActivityTakingQuiz] = useState<Activity | null>(
    null
  );
  const [activityBeingManagedFlashcards, setActivityBeingManagedFlashcards] =
    useState<Activity | null>(null);
  // Set right after creating a quiz or a deck: its manager opens with the
  // form for the first item already up.
  const [startingFollowUp, setStartingFollowUp] =
    useState<ActivityFollowUp | null>(null);
  const [activityInReview, setActivityInReview] = useState<Activity | null>(
    null
  );
  const [activityMarkingDifficulty, setActivityMarkingDifficulty] =
    useState<Activity | null>(null);
  const { arm: armRatingOnReturn, openPdf } = useRateOnReturn(
    setActivityMarkingDifficulty
  );

  const refreshActivities = useCallback(() => {
    startTransition(() => {
      listActivities(moduleId).then((loaded) => {
        setActivities(loaded);
        setHasLoaded(true);
      });
    });
  }, [moduleId]);

  const refreshReviewState = useCallback(() => {
    listActivityReviewState(moduleId).then((rows) => {
      setReviewStateByActivityId(
        Object.fromEntries(
          rows
            .filter((row) => row.activityId !== null)
            .map((row) => [
              row.activityId as string,
              { dueDate: row.dueDate, lastRating: row.lastRating },
            ])
        )
      );
    });
  }, [moduleId]);

  useEffect(() => {
    refreshActivities();
    refreshReviewState();
  }, [refreshActivities, refreshReviewState]);

  useEffect(() => {
    listPrograms().then((programs) => {
      const program = programs.find((item) => item.id === programId);
      setProgramName(program?.name ?? "");
      setProgramColor(program?.color ?? null);
    });
  }, [programId]);

  useEffect(() => {
    listModules(programId).then((modules) => {
      const module = modules.find((item) => item.id === moduleId);
      setModuleName(module?.name ?? "");
    });
  }, [programId, moduleId]);

  const handleCreateClick = useCallback(() => {
    setFormActivity(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((activity: Activity) => {
    setFormActivity(activity);
    setIsFormOpen(true);
  }, []);

  const handleRequestDelete = useCallback((activity: Activity) => {
    setActivityPendingDelete(activity);
  }, []);

  const handleManageQuiz = useCallback((activity: Activity) => {
    setStartingFollowUp(null);
    setActivityBeingManaged(activity);
  }, []);

  const handleTakeQuiz = useCallback((activity: Activity) => {
    setActivityTakingQuiz(activity);
  }, []);

  const handleQuizFinished = useCallback((activity: Activity) => {
    armPendingActivityRating(activity.id);
    setActivityMarkingDifficulty(activity);
  }, []);

  const handleManageFlashcards = useCallback((activity: Activity) => {
    setStartingFollowUp(null);
    setActivityBeingManagedFlashcards(activity);
  }, []);

  const handleStartReview = useCallback((activity: Activity) => {
    setActivityInReview(activity);
  }, []);

  const handleFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open);
  }, []);

  const handleFormSubmit = useCallback(
    (
      title: string,
      type: string,
      url: string | null,
      filePath: string | null
    ) => {
      if (formActivity) {
        updateActivity(formActivity.id, title, type, url, filePath).then(() => {
          setIsFormOpen(false);
          refreshActivities();
        });
        return;
      }

      createActivity(moduleId, title, type, url, filePath).then((created) => {
        setIsFormOpen(false);
        refreshActivities();

        // docs/specs/flashcard-editor-and-creation-flow.md AC-1..3
        const followUp = followUpForCreatedActivity(type);
        setStartingFollowUp(followUp);
        if (followUp === "quizQuestions") {
          setActivityBeingManaged(created);
        } else if (followUp === "flashcards") {
          setActivityBeingManagedFlashcards(created);
        }
      });
    },
    [formActivity, moduleId, refreshActivities]
  );

  const handleImportQuiz = useCallback(
    (title: string, questions: ParsedQuizQuestion[]) => {
      createQuizWithQuestions(moduleId, title, questions).then(() => {
        setIsFormOpen(false);
        refreshActivities();
      });
    },
    [moduleId, refreshActivities]
  );

  const handleQuizManagerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityBeingManaged(null);
      setStartingFollowUp(null);
    }
  }, []);

  const handleQuizRunnerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityTakingQuiz(null);
    }
  }, []);

  // New flashcards are due at once: the rows' review chips must know
  // (docs/specs/today-review-queue.md AC-11).
  const handleFlashcardManagerOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setActivityBeingManagedFlashcards(null);
        setStartingFollowUp(null);
        refreshSchedule();
      }
    },
    [refreshSchedule]
  );

  const handleReviewSessionOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setActivityInReview(null);
        // Reviewed flashcards are no longer due: stop pulsing the deck.
        refreshSchedule();
      }
    },
    [refreshSchedule]
  );

  const handleActivityRated = useCallback(() => {
    refreshReviewState();
    refreshSchedule();
  }, [refreshReviewState, refreshSchedule]);

  // Pending reviews pulse, and so do the activities of the calendar day
  // that led here (docs/specs/calendar-module-review-highlight.md AC-6/7).
  const highlightByActivityId = useMemo(() => {
    const { byActivityId } = summarizeReviewUrgency(scheduleRows, new Date());
    const focusedIds = getFocusedActivityIds(scheduleRows, moduleId, focusDate);

    return Object.fromEntries(
      activities.map((activity) => [
        activity.id,
        toReviewHighlight(
          byActivityId[activity.id],
          focusedIds.has(activity.id)
        ),
      ])
    ) as Record<string, ReviewHighlight | undefined>;
  }, [activities, focusDate, moduleId, scheduleRows]);

  const handleDifficultyDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityMarkingDifficulty(null);
    }
  }, []);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActivityPendingDelete(null);
    }
  }, []);

  // Brings back what was just deleted (docs/specs/safety-net.md AC-2).
  const undoDelete = useCallback(
    (id: string) => {
      restoreActivity(id).then(refreshActivities);
    },
    [refreshActivities]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!activityPendingDelete) {
      return;
    }

    const deleted = activityPendingDelete;
    softDeleteActivity(deleted.id).then(() => {
      setActivityPendingDelete(null);
      refreshActivities();
      // docs/specs/safety-net.md AC-1
      showUndoToast({
        message: t("activityDeletedMessage", { title: deleted.title }),
        onUndo: () => undoDelete(deleted.id),
        undoLabel: t("undoAction"),
      });
    });
  }, [activityPendingDelete, refreshActivities, t, undoDelete]);

  const handleSearchTermChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    []
  );

  const visibleActivities = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    if (!normalizedSearchTerm) {
      return activities;
    }

    return activities.filter((activity) =>
      activity.title.toLowerCase().includes(normalizedSearchTerm)
    );
  }, [activities, searchTerm]);

  const isEmpty = hasLoaded && activities.length === 0;

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-medium font-serif text-3xl tracking-[-0.02em]">
          {t("activitiesPageTitle")}
        </h1>
        {/* One create button per area (docs/specs/onboard-empty-states.md AC-6). */}
        {isEmpty ? null : (
          <Button onClick={handleCreateClick}>
            {t("createActivityAction")}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          aria-label={t("goBackAction")}
          asChild
          size="icon"
          variant="outline"
        >
          <Link params={{ programId }} to="/programs/$programId">
            <ArrowLeft />
          </Link>
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link params={{ programId }} to="/programs/$programId">
                  {programName}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{moduleName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {isEmpty ? (
        <ActivitiesEmptyState onCreate={handleCreateClick} />
      ) : (
        <>
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t("searchActivityPlaceholder")}
              className="pl-7"
              onChange={handleSearchTermChange}
              placeholder={t("searchActivityPlaceholder")}
              value={searchTerm}
            />
          </div>
          <ActivitiesDataTable
            activities={visibleActivities}
            highlightByActivityId={highlightByActivityId}
            onEdit={handleEdit}
            onManageFlashcards={handleManageFlashcards}
            onManageQuiz={handleManageQuiz}
            onOpenLink={armRatingOnReturn}
            onRequestDelete={handleRequestDelete}
            onStartReview={handleStartReview}
            onTakeQuiz={handleTakeQuiz}
            onViewPdf={openPdf}
            reviewStateByActivityId={reviewStateByActivityId}
          />
        </>
      )}
      <ActivityFormDialog
        activity={formActivity}
        onImportQuiz={handleImportQuiz}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
      />
      <DeleteActivityDialog
        activity={activityPendingDelete}
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteDialogOpenChange}
        open={activityPendingDelete !== null}
      />
      <QuizQuestionManagerDialog
        activity={activityBeingManaged}
        onOpenChange={handleQuizManagerOpenChange}
        open={activityBeingManaged !== null}
        startWithNewItem={startingFollowUp === "quizQuestions"}
      />
      <QuizRunnerDialog
        activity={activityTakingQuiz}
        color={programColor}
        onFinished={handleQuizFinished}
        onOpenChange={handleQuizRunnerOpenChange}
        open={activityTakingQuiz !== null}
      />
      <FlashcardManagerDialog
        activity={activityBeingManagedFlashcards}
        color={programColor}
        onOpenChange={handleFlashcardManagerOpenChange}
        open={activityBeingManagedFlashcards !== null}
        startWithNewItem={startingFollowUp === "flashcards"}
      />
      <ReviewSessionDialog
        activity={activityInReview}
        color={programColor}
        onOpenChange={handleReviewSessionOpenChange}
        open={activityInReview !== null}
      />
      <ActivityDifficultyDialog
        activityId={activityMarkingDifficulty?.id ?? null}
        activityTitle={activityMarkingDifficulty?.title ?? ""}
        moduleName={moduleName}
        onOpenChange={handleDifficultyDialogOpenChange}
        onRated={handleActivityRated}
        open={activityMarkingDifficulty !== null}
        programName={programName}
      />
    </div>
  );
}

export const Route = createFileRoute("/programs/$programId/modules/$moduleId")({
  component: ModuleActivitiesPage,
});
