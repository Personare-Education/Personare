// biome-ignore-all lint/style/useFilenamingConvention: TanStack Router file-based routing requires the "$paramName" filename convention for dynamic route segments.
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
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
  getActivityUnlockRule,
  listActivities,
  listProgramActivities,
  reorderActivities,
  restoreActivity,
  setActivityUnlockRule,
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
import OrganizeHeader from "@/components/organize-header";
import QuizQuestionManagerDialog from "@/components/quiz-question-manager-dialog";
import QuizRunnerDialog from "@/components/quiz-runner-dialog";
import ReviewSessionDialog from "@/components/review-session-dialog";
import SequenceManagerDialog from "@/components/sequence-manager-dialog";
import SequenceRunnerDialog from "@/components/sequence-runner-dialog";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UnlockRuleDialog, {
  type UnlockCandidateGroup,
} from "@/components/unlock-rule-dialog";
import { useLocks } from "@/hooks/use-locks";
import { useRateOnReturn } from "@/hooks/use-rate-on-return";
import { useReviewSchedule } from "@/hooks/use-review-schedule";
import {
  type ActivityFollowUp,
  followUpForCreatedActivity,
} from "@/utils/activity-follow-up";
import { describeLock } from "@/utils/lock-text";
import type { ParsedQuizQuestion } from "@/utils/quiz-markdown";
import {
  getFocusedActivityIds,
  type ReviewHighlight,
  summarizeReviewUrgency,
  toReviewHighlight,
} from "@/utils/review-highlight";
import { showUndoToast } from "@/utils/undo-toast";
import type { UnlockMode } from "@/utils/unlock";

const NO_IDS: string[] = [];

function ModuleActivitiesPage() {
  const { i18n, t } = useTranslation();
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
  const [programIcon, setProgramIcon] = useState<string | null>(null);
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
  // A sequence's manager, and how many activities each sequence holds
  // (docs/specs/sequences-and-locks.md §3).
  const [sequenceBeingManaged, setSequenceBeingManaged] =
    useState<Activity | null>(null);
  const [sequenceBeingDone, setSequenceBeingDone] = useState<Activity | null>(
    null
  );
  const [stepCountByGroupId, setStepCountByGroupId] = useState<
    Record<string, number | undefined>
  >({});
  // Locks and the rules behind them (docs/specs/sequences-and-locks.md §4).
  const { locks, refresh: refreshLocks } = useLocks();
  const [programActivities, setProgramActivities] = useState<
    Awaited<ReturnType<typeof listProgramActivities>>
  >([]);
  const [programModules, setProgramModules] = useState<
    { id: string; name: string }[]
  >([]);
  const [ruleSubject, setRuleSubject] = useState<{
    id: string;
    mode: string;
    requiredIds: string[];
    title: string;
  } | null>(null);
  const [activityInReview, setActivityInReview] = useState<Activity | null>(
    null
  );
  const [activityMarkingDifficulty, setActivityMarkingDifficulty] =
    useState<Activity | null>(null);
  const { arm: armRatingOnReturn, openPdf } = useRateOnReturn(
    setActivityMarkingDifficulty
  );

  // How many activities each sequence holds, beside its name (§3 AC-3).
  const refreshStepCounts = useCallback(
    (loaded: Activity[]) => {
      const groups = loaded.filter((activity) => activity.type === "group");
      Promise.all(
        groups.map((group) => listActivities(moduleId, group.id))
      ).then((stepsByGroup) => {
        setStepCountByGroupId(
          Object.fromEntries(
            groups.map((group, index) => [group.id, stepsByGroup[index].length])
          )
        );
      });
    },
    [moduleId]
  );

  const refreshActivities = useCallback(() => {
    startTransition(() => {
      listActivities(moduleId).then((loaded) => {
        setActivities(loaded);
        setHasLoaded(true);
        refreshStepCounts(loaded);
      });
    });
  }, [moduleId, refreshStepCounts]);

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
      setProgramIcon(program?.icon ?? null);
    });
  }, [programId]);

  useEffect(() => {
    listModules(programId).then((modules) => {
      const module = modules.find((item) => item.id === moduleId);
      setModuleName(module?.name ?? "");
      setProgramModules(modules);
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

  const handleManageSequence = useCallback((activity: Activity) => {
    setSequenceBeingManaged(activity);
  }, []);

  const handleRunSequence = useCallback((activity: Activity) => {
    setSequenceBeingDone(activity);
  }, []);

  const handleSequenceRunnerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSequenceBeingDone(null);
    }
  }, []);

  const handleSequenceManagerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSequenceBeingManaged(null);
    }
  }, []);

  // A quiz in a sequence; a new one opens on its first question.
  const handleManageSequenceQuiz = useCallback(
    (quiz: Activity, isNew: boolean) => {
      setStartingFollowUp(isNew ? "quizQuestions" : null);
      setActivityBeingManaged(quiz);
    },
    []
  );

  // One step up or down, saved as the module's new order (§3 AC-4).
  const handleMove = useCallback(
    (activity: Activity, direction: -1 | 1) => {
      const ids = activities.map((row) => row.id);
      const from = ids.indexOf(activity.id);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= ids.length) {
        return;
      }
      [ids[from], ids[to]] = [ids[to], ids[from]];
      reorderActivities(moduleId, null, ids).then(refreshActivities);
    },
    [activities, moduleId, refreshActivities]
  );

  const refreshProgramActivities = useCallback(() => {
    listProgramActivities(programId).then(setProgramActivities);
  }, [programId]);

  useEffect(() => {
    refreshProgramActivities();
  }, [refreshProgramActivities]);

  // What each locked activity is missing, in words (§4 AC-2).
  const lockLabelById = useMemo(() => {
    const names: Record<string, string> = Object.fromEntries([
      ...programActivities.map((row) => [row.id, row.title]),
      ...programModules.map((row) => [row.id, row.name]),
    ]);
    const modeById = Object.fromEntries(
      programActivities.map((row) => [row.id, row.unlockMode])
    );
    return Object.fromEntries(
      Object.entries(locks.activities).flatMap(([id, lock]) =>
        lock
          ? [
              [
                id,
                describeLock(
                  t,
                  i18n.language,
                  lock,
                  modeById[id] ?? "none",
                  names
                ),
              ],
            ]
          : []
      )
    ) as Record<string, string | undefined>;
  }, [i18n.language, locks, programActivities, programModules, t]);

  // What a rule can require: the program's other activities, by module.
  const ruleCandidates = useMemo<UnlockCandidateGroup[]>(() => {
    const groups = new Map<string, UnlockCandidateGroup>();
    for (const row of programActivities) {
      if (row.id === ruleSubject?.id) {
        continue;
      }
      const group = groups.get(row.moduleId) ?? {
        items: [],
        label: row.moduleName,
      };
      group.items.push({
        id: row.id,
        nested: row.parentActivityId !== null,
        title: row.title,
      });
      groups.set(row.moduleId, group);
    }
    return [...groups.values()];
  }, [programActivities, ruleSubject]);

  const handleUnlockRule = useCallback((activity: Activity) => {
    getActivityUnlockRule(activity.id).then((rule) => {
      setRuleSubject({ ...rule, id: activity.id, title: activity.title });
    });
  }, []);

  const handleRuleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setRuleSubject(null);
    }
  }, []);

  const handleRuleSave = useCallback(
    (mode: UnlockMode, requiredIds: string[]) => {
      // An activity's rule never waits for an exam (docs/specs/exams.md §4 AC-5).
      if (!ruleSubject || mode === "exam") {
        return;
      }
      setActivityUnlockRule(ruleSubject.id, mode, requiredIds).then(() => {
        setRuleSubject(null);
        refreshLocks();
        refreshActivities();
        refreshProgramActivities();
        refreshSchedule();
      });
    },
    [
      refreshActivities,
      refreshLocks,
      refreshProgramActivities,
      refreshSchedule,
      ruleSubject,
    ]
  );

  // A sequence was done and rated: its row, the schedule and the locks.
  const handleSequenceRated = useCallback(() => {
    refreshReviewState();
    refreshSchedule();
    refreshActivities();
    refreshProgramActivities();
    refreshLocks();
  }, [
    refreshActivities,
    refreshLocks,
    refreshProgramActivities,
    refreshReviewState,
    refreshSchedule,
  ]);

  // A sequence changed: its steps, order or rules.
  const handleSequenceChanged = useCallback(() => {
    refreshActivities();
    refreshProgramActivities();
    refreshLocks();
  }, [refreshActivities, refreshLocks, refreshProgramActivities]);

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
        refreshProgramActivities();

        // docs/specs/flashcard-editor-and-creation-flow.md AC-1..3
        const followUp = followUpForCreatedActivity(type);
        setStartingFollowUp(followUp);
        if (followUp === "quizQuestions") {
          setActivityBeingManaged(created);
        } else if (followUp === "flashcards") {
          setActivityBeingManagedFlashcards(created);
        } else if (followUp === "sequence") {
          setSequenceBeingManaged(created);
        }
      });
    },
    [formActivity, moduleId, refreshActivities, refreshProgramActivities]
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
      {/* The module's name over the program's tile
          (docs/specs/organize-identity.md). */}
      <OrganizeHeader
        action={
          // One create button per area (docs/specs/onboard-empty-states.md AC-6).
          isEmpty ? null : (
            <Button onClick={handleCreateClick}>
              {t("createActivityAction")}
            </Button>
          )
        }
        color={programColor}
        crumbs={
          <>
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
          </>
        }
        icon={programIcon}
        title={moduleName}
      />
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
            lockLabelById={lockLabelById}
            onEdit={handleEdit}
            onManageFlashcards={handleManageFlashcards}
            onManageQuiz={handleManageQuiz}
            onManageSequence={handleManageSequence}
            // Moving a filtered list would be guesswork (§3 AC-4).
            onMove={searchTerm.trim() ? undefined : handleMove}
            onOpenLink={armRatingOnReturn}
            onRequestDelete={handleRequestDelete}
            onRunSequence={handleRunSequence}
            onStartReview={handleStartReview}
            onTakeQuiz={handleTakeQuiz}
            onUnlockRule={handleUnlockRule}
            onViewPdf={openPdf}
            reviewStateByActivityId={reviewStateByActivityId}
            stepCountByGroupId={stepCountByGroupId}
          />
        </>
      )}
      <SequenceManagerDialog
        group={sequenceBeingManaged}
        lockLabelById={lockLabelById}
        onChanged={handleSequenceChanged}
        onManageQuiz={handleManageSequenceQuiz}
        onOpenChange={handleSequenceManagerOpenChange}
        onUnlockRule={handleUnlockRule}
        open={sequenceBeingManaged !== null}
      />
      <SequenceRunnerDialog
        group={sequenceBeingDone}
        onOpenChange={handleSequenceRunnerOpenChange}
        onRated={handleSequenceRated}
        open={sequenceBeingDone !== null}
      />
      <UnlockRuleDialog
        candidates={ruleCandidates}
        mode={ruleSubject?.mode ?? "none"}
        onOpenChange={handleRuleOpenChange}
        onSave={handleRuleSave}
        open={ruleSubject !== null}
        requiredIds={ruleSubject?.requiredIds ?? NO_IDS}
        subjectTitle={ruleSubject?.title ?? ""}
      />
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
        onFinished={handleQuizFinished}
        onOpenChange={handleQuizRunnerOpenChange}
        onRated={handleActivityRated}
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
