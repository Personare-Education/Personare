/**
 * Which modules and activities are locked, and what each still needs
 * (docs/specs/sequences-and-locks.md §2). Pure: the IPC loads the rows
 * (deleted ones already left out) and every screen reads the same answer.
 */

/**
 * "exam" (after passing an exam) is for modules and exams
 * (docs/specs/exams.md §4); "sources" (after the exam's own modules) for
 * exams only (docs/specs/exam-locks.md).
 */
export type UnlockMode =
  | "none"
  | "previous"
  | "any"
  | "all"
  | "exam"
  | "sources";

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

/** A live exam, whether an attempt has passed it, and its own rule. */
export interface LockExam {
  id: string;
  /** The modules it draws from, for a "sources" rule. */
  moduleIds?: string[];
  passed: boolean;
  unlockMode?: string;
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
  /** docs/specs/exam-locks.md AC-2 */
  exams?: Partial<Record<string, LockState>>;
  modules: Partial<Record<string, LockState>>;
}

export interface LockInput {
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

interface ExamLockContext {
  examById: Map<string, LockExam>;
  isModuleDone: (row: LockModule) => boolean;
  listOf: <T>(subjectId: string, byId: Map<string, T>) => T[];
  moduleById: Map<string, LockModule>;
}

/**
 * An exam's own rule (docs/specs/exam-locks.md AC-2): its modules, a list
 * of modules, or another exam to pass.
 */
function lockExams(
  exams: LockExam[],
  { examById, isModuleDone, listOf, moduleById }: ExamLockContext
): Partial<Record<string, LockState>> {
  const locks: Partial<Record<string, LockState>> = {};
  for (const exam of exams) {
    let missing: MissingItem[];
    if (exam.unlockMode === "exam") {
      missing = listOf(exam.id, examById)
        .filter((required) => !required.passed)
        .map(({ id }) => ({ id, kind: "exam" }));
    } else {
      const sources = exam.unlockMode === "sources";
      const list = sources
        ? (exam.moduleIds ?? [])
            .map((id) => moduleById.get(id))
            .filter((row): row is LockModule => row !== undefined)
        : listOf(exam.id, moduleById);
      missing = missingByRule(
        exam,
        sources ? "all" : (exam.unlockMode ?? "none"),
        [],
        list,
        isModuleDone
      ).map(({ id }) => ({ id, kind: "module" }));
    }
    if (missing.length > 0) {
      locks[exam.id] = { locked: true, missing };
    }
  }
  return locks;
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

  locks.exams = lockExams(exams, {
    examById,
    isModuleDone,
    listOf,
    moduleById,
  });

  return locks;
}

/** What one rule waits for, as graph nodes (see findLockCycle). */
function ruleNodes(
  mode: string | undefined,
  list: string[],
  listKind: "e" | "md"
): string[] {
  if (mode === "exam") {
    return list.map((id) => `e:${id}`);
  }
  return mode === "any" || mode === "all"
    ? list.map((id) => `${listKind}:${id}`)
    : [];
}

function waitsForGraph({
  activities,
  exams = [],
  modules,
  requirements,
}: LockInput): (node: string) => string[] {
  const moduleById = new Map(modules.map((row) => [row.id, row]));
  const activityById = new Map(activities.map((row) => [row.id, row]));
  const examById = new Map(exams.map((row) => [row.id, row]));
  const listOf = (id: string) =>
    requirements
      .filter((row) => row.subjectId === id)
      .map((row) => row.requiredId);
  const before = <T extends { id: string; position: number }>(
    siblings: T[],
    row: T
  ) =>
    byPosition(siblings)
      .filter((other) => other.position < row.position)
      .map((other) => other.id);

  // A module unlocks when its rule is met.
  const moduleUnlock = (id: string): string[] => {
    const row = moduleById.get(id);
    if (row?.unlockMode !== "previous") {
      return ruleNodes(row?.unlockMode, listOf(id), "md");
    }
    return before(
      modules.filter((other) => other.programId === row.programId),
      row
    ).map((other) => `md:${other}`);
  };
  // A module is done once it unlocks and its first-level activities are done.
  const moduleDone = (id: string): string[] => [
    `m:${id}`,
    ...activities
      .filter((row) => row.moduleId === id && row.parentActivityId === null)
      .map((row) => `a:${row.id}`),
  ];
  // An activity is done once its module, its sequence and its rule allow.
  const activityDone = (id: string): string[] => {
    const row = activityById.get(id);
    if (!row) {
      return [];
    }
    let own: string[] = [];
    if (row.unlockMode === "previous") {
      own = before(
        activities.filter(
          (other) =>
            other.moduleId === row.moduleId &&
            other.parentActivityId === row.parentActivityId
        ),
        row
      );
    } else if (row.unlockMode === "any" || row.unlockMode === "all") {
      own = listOf(id);
    }
    return [
      `m:${row.moduleId}`,
      ...(row.parentActivityId ? [`a:${row.parentActivityId}`] : []),
      ...own.map((other) => `a:${other}`),
    ];
  };
  // An exam is passed only once it unlocks.
  const examPassed = (id: string): string[] => {
    const exam = examById.get(id);
    return exam?.unlockMode === "sources"
      ? (exam.moduleIds ?? []).map((moduleId) => `md:${moduleId}`)
      : ruleNodes(exam?.unlockMode, listOf(id), "md");
  };

  const byKind: Record<string, (id: string) => string[]> = {
    a: activityDone,
    e: examPassed,
    m: moduleUnlock,
    md: moduleDone,
  };
  return (node) => {
    const split = node.indexOf(":");
    return byKind[node.slice(0, split)]?.(node.slice(split + 1)) ?? [];
  };
}

/**
 * Whether the rules of `subjectId` (a module or an exam) make it wait, step
 * by step, for itself -- locked for good (docs/specs/exam-locks.md AC-4).
 * An any-of rule counts each choice, which errs on the side of refusing.
 */
export function findLockCycle(input: LockInput, subjectId: string): boolean {
  const waitsFor = waitsForGraph(input);
  const start = input.modules.some((row) => row.id === subjectId)
    ? `m:${subjectId}`
    : `e:${subjectId}`;
  const seen = new Set<string>();
  const pending = waitsFor(start);
  while (pending.length > 0) {
    const node = pending.pop() as string;
    if (node === start) {
      return true;
    }
    if (!seen.has(node)) {
      seen.add(node);
      pending.push(...waitsFor(node));
    }
  }
  return false;
}

/** The ids of every locked activity, to leave out of the schedule (AC-6). */
export function lockedActivityIds(locks: Locks): Set<string> {
  return new Set(Object.keys(locks.activities));
}
