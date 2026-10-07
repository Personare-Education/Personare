/**
 * Which questions an exam attempt draws (docs/specs/exams.md §1 AC-7).
 * Pure, with the randomness injected: the IPC loads the live questions of
 * each module's quizzes and the exam's standalone ones.
 */

export interface ExamQuestionPool {
  moduleId: string;
  questionIds: string[];
}

interface DrawInput {
  pools: ExamQuestionPool[];
  /** A number in [0, 1), as Math.random gives. */
  random?: () => number;
  /** Always in, beyond the total. */
  standaloneIds: string[];
  /** How many to draw from the modules. */
  total: number;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * How many each module gives: the total split evenly, what the division
 * leaves over to modules picked at random, and a short module's shortfall
 * passed on to the others. Never more than there is.
 */
function allocate(
  sizes: number[],
  total: number,
  random: () => number
): number[] {
  const counts = sizes.map(() => 0);
  let remaining = Math.min(
    total,
    sizes.reduce((sum, size) => sum + size, 0)
  );

  while (remaining > 0) {
    const open = sizes
      .map((size, index) => (counts[index] < size ? index : -1))
      .filter((index) => index !== -1);
    const share = Math.floor(remaining / open.length);
    const lucky = new Set(
      shuffled(open, random).slice(0, remaining % open.length)
    );
    for (const index of open) {
      const wanted = share + (lucky.has(index) ? 1 : 0);
      const given = Math.min(wanted, sizes[index] - counts[index]);
      counts[index] += given;
      remaining -= given;
    }
  }

  return counts;
}

export function drawExamQuestions({
  pools,
  random = Math.random,
  standaloneIds,
  total,
}: DrawInput): string[] {
  const shuffledPools = pools.map((pool) => shuffled(pool.questionIds, random));
  const counts = allocate(
    shuffledPools.map((ids) => ids.length),
    total,
    random
  );
  const drawn = shuffledPools.flatMap((ids, index) =>
    ids.slice(0, counts[index])
  );

  return shuffled([...new Set([...drawn, ...standaloneIds])], random);
}
