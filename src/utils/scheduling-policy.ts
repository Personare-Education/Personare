import { differenceInCalendarDays, subDays } from "date-fns";
import { parseDayKey, type StudyGoal } from "@/utils/study-goal";

/**
 * The scheduling policy per study goal (docs/architecture/scheduling.md D6):
 * the memory model (ts-fsrs) proposes a due date, and the program's goal
 * decides. Pure, so the simulator (D9) can run it too.
 */

export interface ProgramGoal {
  studyGoal: StudyGoal;
  targetDate: string | null;
}

/** Calendar days from today to the test's day; negative once it passed. */
export function daysUntilTest(targetDate: string, now: Date): number {
  const day = parseDayKey(targetDate);
  return day ? differenceInCalendarDays(day, now) : Number.NaN;
}

/**
 * Studying for a test up to and including its day; afterwards the program
 * acts as "Nunca mais esquecer" (D2).
 */
export function isPreparingForTest(
  program: ProgramGoal | null,
  now: Date
): program is ProgramGoal & { targetDate: string } {
  return (
    program?.studyGoal === "test_prep" &&
    program.targetDate !== null &&
    daysUntilTest(program.targetDate, now) >= 0
  );
}

/**
 * Mode B v1 (D7): nothing comes due after the test's eve -- the start of the
 * day before it. When the eve has passed (the test is today or tomorrow),
 * or for "Nunca mais esquecer", the FSRS due date stands.
 */
export function scheduleForGoal(
  fsrsDue: Date,
  program: ProgramGoal | null,
  now: Date
): Date {
  if (!isPreparingForTest(program, now)) {
    return fsrsDue;
  }
  const testDay = parseDayKey(program.targetDate);
  if (!testDay) {
    return fsrsDue;
  }
  const eve = subDays(testDay, 1);
  if (eve.getTime() <= now.getTime()) {
    return fsrsDue;
  }
  return fsrsDue.getTime() > eve.getTime() ? eve : fsrsDue;
}
