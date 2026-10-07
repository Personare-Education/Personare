/**
 * Which modules and activities are locked, and what each still needs
 * (docs/specs/sequences-and-locks.md §2). Pure: the IPC loads the rows
 * (deleted ones already left out) and every screen reads the same answer.
 */

/** "exam" is for modules only: after passing an exam (docs/specs/exams.md §4). */
export type UnlockMode = "none" | "previous" | "any" | "all" | "exam";

export interface LockModule {
  id: string;
  position: number;
  programId: string;
  unlockMode: string;
}

export interface LockActivity {
  completedAt: Date | null;
  id: string;
  moduleId: string;
  parentActivityId: string | null;
  position: number;
  unlockMode: string;
}

/** A live exam, and whether an attempt has passed it. */
export interface LockExam {
  id: string;
  passed: boolean;
}

export interface LockRequirement {
  requiredId: string;
  subjectId: string;
  subjectKind: string;
}

/** Something that must be done (or unlocked) first. */
export interface MissingItem {
  id: string;
  kind: "activity" | "exam" | "module";
}

export interface LockState {
  locked: true;
  /** What is still missing, in list order. */
  missing: MissingItem[];
  /** Locked because its module or its sequence is: `missing` is that one. */
  waiting?: true;
}

/** Only what is locked; anything absent is free. */
export interface Locks {
  activities: Partial<Record<string, LockState>>;
  modules: Partial<Record<string, LockState>>;
}

interface LockInput {
  activities: LockActivity[];
  /** Live exams; one a rule points at that is not here no longer locks. */
  exams?: LockExam[];
  modules: LockModule[];
  requirements: LockRequirement[];
}

function byPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/**
 * What an item's own rule still needs: "previous" looks at the items before
 * it in `siblings` (already in order); "any"/"all" at its list, minus what
 * no longer exists. An empty list never locks (AC-4).
 */
function missingByRule<T extends { id: string }>(
  item: T,
  mode: string,
  siblings: T[],
  list: T[],
  isDone: (candidate: T) => boolean
): T[] {
  if (mode === "previous") {
    const before = siblings.slice(
      0,
      siblings.findIndex((sibling) => sibling.id === item.id)
    );
    return before.filter((candidate) => !isDone(candidate));
  }
  if (list.length === 0) {
    return [];
  }
  if (mode === "any") {
    return list.some(isDone) ? [] : list;
  }
  if (mode === "all") {
    return list.filter((candidate) => !isDone(candidate));
  }
  return [];
}

export function computeLocks({
  activities,
  exams = [],
  modules,
  requirements,
}: LockInput): Locks {
  const activityById = new Map(activities.map((row) => [row.id, row]));
  const moduleById = new Map(modules.map((row) => [row.id, row]));
  const examById = new Map(exams.map((row) => [row.id, row]));

  const listOf = <T>(subjectId: string, byId: Map<string, T>): T[] =>
    requirements
      .filter((row) => row.subjectId === subjectId)
      .map((row) => byId.get(row.requiredId))
      .filter((row): row is T => row !== undefined);

  const isActivityDone = (row: LockActivity) => row.completedAt !== null;

  // A module is done when it has first-level activities, all done (AC-2).
  const firstLevelByModule = new Map<string, LockActivity[]>();
  for (const row of activities) {
    if (row.parentActivityId === null) {
      firstLevelByModule.set(row.moduleId, [
        ...(firstLevelByModule.get(row.moduleId) ?? []),
        row,
      ]);
    }
  }
  const isModuleDone = (row: LockModule) => {
    const rows = firstLevelByModule.get(row.id) ?? [];
    return rows.length > 0 && rows.every(isActivityDone);
  };

  const locks: Locks = { activities: {}, modules: {} };

  for (const row of modules) {
    // Free once its exam is passed (docs/specs/exams.md §4 AC-2).
    if (row.unlockMode === "exam") {
      const pending = listOf(row.id, examById).filter((exam) => !exam.passed);
      if (pending.length > 0) {
        locks.modules[row.id] = {
          locked: true,
          missing: pending.map(({ id }) => ({ id, kind: "exam" })),
        };
      }
      continue;
    }
    const siblings = byPosition(
      modules.filter((other) => other.programId === row.programId)
    );
    const missing = missingByRule(
      row,
      row.unlockMode,
      siblings,
      listOf(row.id, moduleById),
      isModuleDone
    );
    if (missing.length > 0) {
      locks.modules[row.id] = {
        locked: true,
        missing: missing.map(({ id }) => ({ id, kind: "module" })),
      };
    }
  }

  // An activity's own rule; its module's and group's locks come after.
  const ownMissing = new Map<string, LockActivity[]>();
  for (const row of activities) {
    const siblings = byPosition(
      activities.filter(
        (other) =>
          other.moduleId === row.moduleId &&
          other.parentActivityId === row.parentActivityId
      )
    );
    ownMissing.set(
      row.id,
      missingByRule(
        row,
        row.unlockMode,
        siblings,
        listOf(row.id, activityById),
        isActivityDone
      )
    );
  }

  const lockOf = (row: LockActivity): LockState | undefined => {
    // Locked with its module or its group: what is missing is unlocking
    // that first (AC-3).
    if (locks.modules[row.moduleId]) {
      return {
        locked: true,
        missing: [{ id: row.moduleId, kind: "module" }],
        waiting: true,
      };
    }
    if (row.parentActivityId) {
      const group = activityById.get(row.parentActivityId);
      if (group && lockOf(group)) {
        return {
          locked: true,
          missing: [{ id: group.id, kind: "activity" }],
          waiting: true,
        };
      }
    }
    const missing = ownMissing.get(row.id) ?? [];
    return missing.length > 0
      ? {
          locked: true,
          missing: missing.map(({ id }) => ({ id, kind: "activity" })),
        }
      : undefined;
  };

  for (const row of activities) {
    const lock = lockOf(row);
    if (lock) {
      locks.activities[row.id] = lock;
    }
  }

  return locks;
}

/** The ids of every locked activity, to leave out of the schedule (AC-6). */
export function lockedActivityIds(locks: Locks): Set<string> {
  return new Set(Object.keys(locks.activities));
}
