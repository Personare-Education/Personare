import { and, eq, isNull } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  examModules as examModulesTable,
  exams as examsTable,
  flashcards as flashcardsTable,
  modules as modulesTable,
  programs as programsTable,
  quizOptions as quizOptionsTable,
  quizQuestions as quizQuestionsTable,
} from "@/database/schema";
import {
  cascadeSoftDeleteActivity,
  cascadeSoftDeleteModule,
} from "@/ipc/shared/cascade-soft-delete";
import {
  quizQuestionIdsByModule,
  saveExamUnlockRule,
} from "@/ipc/shared/exams";
import {
  GROUP_ACTIVITY_TYPE,
  nextActivityPosition,
  nextModulePosition,
  setUnlockRule,
} from "@/ipc/shared/sequences";
import {
  type ParsedActivity,
  type ParsedExam,
  type ParsedLink,
  type ParsedModule,
  type ParsedQuiz,
  type ParsedRule,
  type ProgramWarning,
  parseProgramMarkdown,
} from "@/utils/program-markdown";
import type { ParsedQuizQuestion } from "@/utils/quiz-markdown";

/**
 * Saving a program read from Markdown (docs/specs/program-import.md §2):
 * a new one, or completing the one with the same name, in one
 * transaction. The preview runs the same import and rolls it back, so it
 * shows exactly what importing would do.
 */

export type ImportRuleIssue =
  | "examDrawsFromModule"
  | "keptExisting"
  | "unknownName"
  | "wouldLockForGood";

export interface ImportActivityReport {
  /** Questions, cards or steps it brings; 0 for a link. */
  count: number;
  /** Already there, with the same type and title: left out. */
  skipped: boolean;
  steps?: ImportActivityReport[];
  title: string;
  type: ParsedActivity["type"];
}

export interface ImportModuleReport {
  activities: ImportActivityReport[];
  existed: boolean;
  line: number;
  name: string;
  /** The file's rule, as written. */
  rule: ParsedRule | null;
  ruleIssue?: ImportRuleIssue;
}

export interface ImportExamReport {
  /** Modules it named that it cannot draw from (unknown, or no quiz). */
  droppedModules: string[];
  line: number;
  reason?: "exists" | "noModules";
  rule: ParsedRule | null;
  ruleIssue?: ImportRuleIssue;
  skipped: boolean;
  title: string;
}

/** What one import created, for undoing it (§2 AC-6). */
export interface ImportCreated {
  activityIds: string[];
  examIds: string[];
  moduleIds: string[];
  /** Set when the import created the program itself. */
  programId: string | null;
}

export interface ImportReport {
  created: ImportCreated;
  exams: ImportExamReport[];
  modules: ImportModuleReport[];
  programExisted: boolean;
  programId: string;
  programName: string;
  warnings: ProgramWarning[];
}

/** Names compare without case or the spaces around them (§ Completar). */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

class ImportRollback extends Error {}

class ProgramImport {
  private readonly db: DatabaseClient;
  private readonly start = Date.now();
  private tick = 0;
  readonly created: ImportCreated = {
    activityIds: [],
    examIds: [],
    moduleIds: [],
    programId: null,
  };

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /** Increasing timestamps keep the file's order for things listed by them. */
  private now(): Date {
    this.tick += 1;
    return new Date(this.start + this.tick);
  }

  program(name: string): { existed: boolean; id: string } {
    const found = this.db
      .select({ id: programsTable.id, name: programsTable.name })
      .from(programsTable)
      .where(isNull(programsTable.deletedAt))
      .all()
      .find((row) => sameName(row.name, name));
    if (found) {
      return { existed: true, id: found.id };
    }
    const now = this.now();
    const { id } = this.db
      .insert(programsTable)
      .values({ createdAt: now, name: name.trim(), updatedAt: now })
      .returning({ id: programsTable.id })
      .get();
    this.created.programId = id;
    return { existed: false, id };
  }

  module(programId: string, name: string): { existed: boolean; id: string } {
    const found = this.db
      .select({ id: modulesTable.id, name: modulesTable.name })
      .from(modulesTable)
      .where(
        and(
          eq(modulesTable.programId, programId),
          isNull(modulesTable.deletedAt)
        )
      )
      .all()
      .find((row) => sameName(row.name, name));
    if (found) {
      return { existed: true, id: found.id };
    }
    const now = this.now();
    const { id } = this.db
      .insert(modulesTable)
      .values({
        createdAt: now,
        name: name.trim(),
        // New ones go at the end (docs/specs/sequences-and-locks.md §1 AC-2).
        position: nextModulePosition(this.db, programId),
        programId,
        updatedAt: now,
      })
      .returning({ id: modulesTable.id })
      .get();
    this.created.moduleIds.push(id);
    return { existed: false, id };
  }

  /** A live activity of this type and title in that place, if there is one. */
  private findActivity(
    moduleId: string,
    parentActivityId: string | null,
    type: string,
    title: string
  ) {
    return this.db
      .select()
      .from(activitiesTable)
      .where(
        and(
          eq(activitiesTable.moduleId, moduleId),
          parentActivityId
            ? eq(activitiesTable.parentActivityId, parentActivityId)
            : isNull(activitiesTable.parentActivityId),
          eq(activitiesTable.type, type),
          isNull(activitiesTable.deletedAt)
        )
      )
      .all()
      .find((row) => sameName(row.title, title));
  }

  private insertActivity(values: {
    moduleId: string;
    parentActivityId: string | null;
    title: string;
    type: string;
    unlockMode?: string;
    url?: string | null;
  }): string {
    const now = this.now();
    const { id } = this.db
      .insert(activitiesTable)
      .values({
        createdAt: now,
        moduleId: values.moduleId,
        parentActivityId: values.parentActivityId,
        position: nextActivityPosition(
          this.db,
          values.moduleId,
          values.parentActivityId
        ),
        title: values.title.trim(),
        type: values.type,
        unlockMode: values.unlockMode ?? "none",
        updatedAt: now,
        url: values.url ?? null,
      })
      .returning({ id: activitiesTable.id })
      .get();
    this.created.activityIds.push(id);
    return id;
  }

  /** Questions with their alternatives, for a quiz or an exam. */
  questions(
    owner: { activityId: string } | { examId: string },
    questions: ParsedQuizQuestion[]
  ): void {
    for (const question of questions) {
      const createdAt = this.now();
      const { id: questionId } = this.db
        .insert(quizQuestionsTable)
        .values({
          activityId: "activityId" in owner ? owner.activityId : null,
          createdAt,
          examId: "examId" in owner ? owner.examId : null,
          text: question.text,
          updatedAt: createdAt,
        })
        .returning({ id: quizQuestionsTable.id })
        .get();
      for (const option of question.options) {
        const optionCreatedAt = this.now();
        this.db
          .insert(quizOptionsTable)
          .values({
            createdAt: optionCreatedAt,
            isCorrect: option.isCorrect,
            questionId,
            text: option.text,
            updatedAt: optionCreatedAt,
          })
          .run();
      }
    }
  }

  private step(
    moduleId: string,
    parentActivityId: string | null,
    activity: ParsedLink | ParsedQuiz,
    unlockMode: string
  ): ImportActivityReport {
    const report: ImportActivityReport = {
      count: activity.type === "quiz" ? activity.questions.length : 0,
      skipped: false,
      title: activity.title,
      type: activity.type,
    };
    if (
      this.findActivity(
        moduleId,
        parentActivityId,
        activity.type,
        activity.title
      )
    ) {
      return { ...report, skipped: true };
    }
    const id = this.insertActivity({
      moduleId,
      parentActivityId,
      title: activity.title,
      type: activity.type,
      unlockMode,
      url: activity.type === "link" ? activity.url : null,
    });
    if (activity.type === "quiz") {
      this.questions({ activityId: id }, activity.questions);
    }
    return report;
  }

  activity(moduleId: string, activity: ParsedActivity): ImportActivityReport {
    if (activity.type === "link" || activity.type === "quiz") {
      return this.step(moduleId, null, activity, "none");
    }
    if (activity.type === "flashcards") {
      const report: ImportActivityReport = {
        count: activity.cards.length,
        skipped: false,
        title: activity.title,
        type: "flashcards",
      };
      if (this.findActivity(moduleId, null, "flashcard_deck", activity.title)) {
        return { ...report, skipped: true };
      }
      const activityId = this.insertActivity({
        moduleId,
        parentActivityId: null,
        title: activity.title,
        type: "flashcard_deck",
      });
      for (const card of activity.cards) {
        const now = this.now();
        this.db
          .insert(flashcardsTable)
          .values({
            activityId,
            back: card.back,
            createdAt: now,
            front: card.front,
            updatedAt: now,
          })
          .run();
      }
      return report;
    }

    // A sequence that is already there takes the new steps, in its own
    // order -- locked if its steps already wait for each other.
    const existing = this.findActivity(
      moduleId,
      null,
      GROUP_ACTIVITY_TYPE,
      activity.title
    );
    let groupId: string;
    let locked: boolean;
    if (existing) {
      groupId = existing.id;
      locked = this.db
        .select({ mode: activitiesTable.unlockMode })
        .from(activitiesTable)
        .where(
          and(
            eq(activitiesTable.parentActivityId, existing.id),
            isNull(activitiesTable.deletedAt)
          )
        )
        .all()
        .some((row) => row.mode === "previous");
    } else {
      groupId = this.insertActivity({
        moduleId,
        parentActivityId: null,
        title: activity.title,
        type: GROUP_ACTIVITY_TYPE,
      });
      locked = activity.order === "lock";
    }
    const steps = activity.steps.map((step) => {
      // The first step of the sequence is free; the rest wait in order.
      const isFirst =
        this.db
          .select({ id: activitiesTable.id })
          .from(activitiesTable)
          .where(
            and(
              eq(activitiesTable.parentActivityId, groupId),
              isNull(activitiesTable.deletedAt)
            )
          )
          .all().length === 0;
      return this.step(
        moduleId,
        groupId,
        step,
        locked && !isFirst ? "previous" : "none"
      );
    });
    return {
      count: activity.steps.length,
      skipped: existing !== undefined && steps.every((step) => step.skipped),
      steps,
      title: activity.title,
      type: "sequence",
    };
  }

  /**
   * An exam with the modules it can draw from -- known ones with quiz
   * questions -- and its standalone questions (§ O que dá errado).
   */
  exam(
    programId: string,
    exam: ParsedExam,
    moduleIdByName: (name: string) => string | undefined
  ): Omit<ImportExamReport, "rule" | "ruleIssue"> & { id?: string } {
    const exists = this.db
      .select({ title: examsTable.title })
      .from(examsTable)
      .where(
        and(eq(examsTable.programId, programId), isNull(examsTable.deletedAt))
      )
      .all()
      .some((row) => sameName(row.title, exam.title));
    if (exists) {
      return {
        droppedModules: [],
        line: exam.line,
        reason: "exists",
        skipped: true,
        title: exam.title,
      };
    }
    const named = exam.moduleNames.map((name) => ({
      id: moduleIdByName(name),
      name,
    }));
    const counts = quizQuestionIdsByModule(
      this.db,
      named.flatMap((row) => (row.id ? [row.id] : []))
    );
    const usable = named.filter(
      (row) => row.id !== undefined && (counts.get(row.id) ?? []).length > 0
    );
    const droppedModules = named
      .filter((row) => !usable.includes(row))
      .map(({ name }) => name);
    if (usable.length === 0) {
      return {
        droppedModules,
        line: exam.line,
        reason: "noModules",
        skipped: true,
        title: exam.title,
      };
    }
    const now = this.now();
    const { id } = this.db
      .insert(examsTable)
      .values({
        createdAt: now,
        passingScore: Math.min(100, Math.max(1, exam.passingScore)),
        programId,
        questionCount: Math.max(1, exam.questionCount),
        timeLimitMinutes:
          exam.timeLimitMinutes && exam.timeLimitMinutes > 0
            ? exam.timeLimitMinutes
            : null,
        title: exam.title.trim(),
        updatedAt: now,
      })
      .returning({ id: examsTable.id })
      .get();
    this.db
      .insert(examModulesTable)
      .values(
        [...new Set(usable.map((row) => row.id as string))].map((moduleId) => ({
          examId: id,
          moduleId,
        }))
      )
      .run();
    this.questions({ examId: id }, exam.questions);
    this.created.examIds.push(id);
    return {
      droppedModules,
      id,
      line: exam.line,
      skipped: false,
      title: exam.title,
    };
  }
}

interface Names {
  examIdByName: (name: string) => string | undefined;
  moduleIdByName: (name: string) => string | undefined;
}

/** A rule's names as ids, or why it cannot be applied. */
function resolveRule(
  rule: ParsedRule,
  { examIdByName, moduleIdByName }: Names
): { ids: string[] } | { issue: ImportRuleIssue } {
  const lookup = rule.mode === "exam" ? examIdByName : moduleIdByName;
  const ids = rule.names.map(lookup);
  return ids.every((id) => id !== undefined)
    ? { ids: ids as string[] }
    : { issue: "unknownName" };
}

function applyModuleRule(
  db: DatabaseClient,
  moduleId: string,
  rule: ParsedRule,
  names: Names
): ImportRuleIssue | undefined {
  const resolved = resolveRule(rule, names);
  if ("issue" in resolved) {
    return resolved.issue;
  }
  // An exam drawing from the module would never unlock it (exams.md §4).
  if (
    rule.mode === "exam" &&
    db
      .select({ id: examModulesTable.id })
      .from(examModulesTable)
      .where(
        and(
          eq(examModulesTable.examId, resolved.ids[0]),
          eq(examModulesTable.moduleId, moduleId)
        )
      )
      .get()
  ) {
    return "examDrawsFromModule";
  }
  try {
    setUnlockRule(
      db,
      "module",
      moduleId,
      rule.mode as "all" | "any" | "exam" | "previous",
      resolved.ids
    );
  } catch {
    return "wouldLockForGood";
  }
}

function applyExamRule(
  db: DatabaseClient,
  examId: string,
  rule: ParsedRule,
  names: Names
): ImportRuleIssue | undefined {
  const resolved = resolveRule(rule, names);
  if ("issue" in resolved) {
    return resolved.issue;
  }
  try {
    saveExamUnlockRule(db, examId, rule.mode, resolved.ids);
  } catch {
    return "wouldLockForGood";
  }
}

function runImport(db: DatabaseClient, markdown: string): ImportReport {
  const { program, warnings } = parseProgramMarkdown(markdown);
  if (!program) {
    throw new Error("The file has no program heading");
  }
  const run = new ProgramImport(db);
  const { existed: programExisted, id: programId } = run.program(program.name);

  const moduleRows: {
    existed: boolean;
    id: string;
    parsed: ParsedModule;
  }[] = [];
  const modules: ImportModuleReport[] = program.modules.map((parsed) => {
    const { existed, id } = run.module(programId, parsed.name);
    moduleRows.push({ existed, id, parsed });
    return {
      activities: parsed.activities.map((activity) =>
        run.activity(id, activity)
      ),
      existed,
      line: parsed.line,
      name: parsed.name,
      rule: parsed.rule,
    };
  });

  // Names resolve against the file and the program alike (§2 AC-4).
  const liveModules = () =>
    db
      .select({ id: modulesTable.id, name: modulesTable.name })
      .from(modulesTable)
      .where(
        and(
          eq(modulesTable.programId, programId),
          isNull(modulesTable.deletedAt)
        )
      )
      .all();
  const moduleIdByName = (name: string) =>
    liveModules().find((row) => sameName(row.name, name))?.id;
  const examIdByName = (name: string) =>
    db
      .select({ id: examsTable.id, title: examsTable.title })
      .from(examsTable)
      .where(
        and(eq(examsTable.programId, programId), isNull(examsTable.deletedAt))
      )
      .all()
      .find((row) => sameName(row.title, name))?.id;

  const examRows = program.exams.map((parsed) => ({
    parsed,
    result: run.exam(programId, parsed, moduleIdByName),
  }));

  // Rules last, once everything they can name exists; only new modules and
  // exams take the file's (§2 AC-4).
  const names = { examIdByName, moduleIdByName };
  moduleRows.forEach(({ existed, id, parsed }, index) => {
    if (!parsed.rule) {
      return;
    }
    const issue = existed
      ? "keptExisting"
      : applyModuleRule(db, id, parsed.rule, names);
    if (issue) {
      modules[index].ruleIssue = issue;
    }
  });
  const exams: ImportExamReport[] = examRows.map(({ parsed, result }) => {
    const { id, ...report } = result;
    const ruleIssue =
      id && parsed.rule ? applyExamRule(db, id, parsed.rule, names) : undefined;
    return {
      ...report,
      rule: parsed.rule,
      ...(ruleIssue ? { ruleIssue } : {}),
    };
  });
  return {
    created: run.created,
    exams,
    modules,
    programExisted,
    programId,
    programName: program.name,
    warnings,
  };
}

/** Imports the file, all or nothing (§2 AC-5). */
export function importProgram(
  db: DatabaseClient,
  markdown: string
): ImportReport {
  return db.transaction((tx) =>
    runImport(tx as unknown as DatabaseClient, markdown)
  );
}

/** What importing would do, without keeping any of it (§3 AC-2). */
export function previewProgramImport(
  db: DatabaseClient,
  markdown: string
): ImportReport {
  let report: ImportReport | null = null;
  try {
    db.transaction((tx) => {
      report = runImport(tx as unknown as DatabaseClient, markdown);
      throw new ImportRollback();
    });
  } catch (error) {
    if (!(error instanceof ImportRollback)) {
      throw error;
    }
  }
  return report as unknown as ImportReport;
}

/** Takes away what one import created, and only that (§2 AC-6). */
export function undoProgramImport(
  db: DatabaseClient,
  created: ImportCreated
): void {
  const now = new Date();
  db.transaction((tx) => {
    const client = tx as unknown as DatabaseClient;
    for (const id of created.examIds) {
      tx.update(examsTable)
        .set({ deletedAt: now })
        .where(and(eq(examsTable.id, id), isNull(examsTable.deletedAt)))
        .run();
    }
    for (const id of created.activityIds) {
      tx.update(activitiesTable)
        .set({ deletedAt: now })
        .where(
          and(eq(activitiesTable.id, id), isNull(activitiesTable.deletedAt))
        )
        .run();
      cascadeSoftDeleteActivity(client, id, now);
    }
    for (const id of created.moduleIds) {
      tx.update(modulesTable)
        .set({ deletedAt: now })
        .where(and(eq(modulesTable.id, id), isNull(modulesTable.deletedAt)))
        .run();
      cascadeSoftDeleteModule(client, id, now);
    }
    if (created.programId) {
      tx.update(programsTable)
        .set({ deletedAt: now })
        .where(eq(programsTable.id, created.programId))
        .run();
    }
  });
}
