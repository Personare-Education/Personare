import { call, ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { activities } from "@/ipc/activities";
import { exams } from "@/ipc/exams";
import { flashcards } from "@/ipc/flashcards";
import { modules } from "@/ipc/modules";
import { programs } from "@/ipc/programs";
import { createProgramInputSchema } from "@/ipc/programs/schemas";
import { quiz } from "@/ipc/quiz";

/**
 * What the MCP bridge serves (docs/specs/mcp-create-program.md,
 * docs/specs/mcp-content-tools.md): each procedure is one MCP tool, made of
 * the IPC's own handlers. When a step fails, what the earlier steps created
 * is deleted the app's way (soft delete), so nothing is left half made.
 */

/** What changed, so the open window can reload it. */
export type DataTopic = "activities" | "exams" | "modules" | "programs";

const unlockSchema = z
  .object({
    mode: z.string(),
    requiredIds: z.array(z.string()).default([]),
  })
  .optional();

type UnlockInput = z.infer<typeof unlockSchema>;

const questionSchema = z.object({
  options: z
    .array(z.object({ isCorrect: z.boolean(), text: z.string().min(1) }))
    .min(2),
  text: z.string().min(1),
});

const flashcardSchema = z.object({
  back: z.string().min(1),
  front: z.string().min(1),
});

/** An activity a sequence can hold: a link, a PDF or a quiz. */
const stepSchema = z.object({
  filePath: z.string().optional(),
  questions: z.array(questionSchema).optional(),
  title: z.string().min(1),
  type: z.enum(["link", "pdf", "quiz"]),
  url: z.string().optional(),
});

const activitySchema = stepSchema.extend({
  flashcards: z.array(flashcardSchema).optional(),
  moduleId: z.string(),
  order: z.enum(["lock", "suggest"]).optional(),
  steps: z.array(stepSchema).optional(),
  type: z.enum(["link", "pdf", "quiz", "flashcard_deck", "sequence"]),
  unlock: unlockSchema,
});

const examSchema = z.object({
  moduleIds: z.array(z.string()).min(1),
  passingScore: z.number().int().min(1).max(100).default(70),
  programId: z.string(),
  questionCount: z.number().int().min(1),
  questions: z.array(questionSchema).optional(),
  timeLimitMinutes: z.number().int().min(1).nullable().default(null),
  title: z.string().min(1),
  unlock: unlockSchema,
});

type StepInput = z.infer<typeof stepSchema>;
type ActivityInput = z.infer<typeof activitySchema>;

interface CreatedActivity {
  id: string;
  title: string;
  type: string;
}

/** The handlers' own message reaches Claude: oRPC hides plain errors. */
async function withReason<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ORPCError) {
      throw error;
    }
    throw new ORPCError("BAD_REQUEST", {
      cause: error,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Runs `rest` after creating; if it fails, deletes what was created. */
async function orUndo(
  rest: () => Promise<void>,
  undo: () => Promise<unknown>
): Promise<void> {
  try {
    await rest();
  } catch (error) {
    await undo().catch(() => undefined);
    throw error;
  }
}

/**
 * One after the other: each item lands at the end of its list, so the order
 * Claude gave is the order the app shows.
 */
async function inOrder<T, R>(
  items: readonly T[],
  run: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (const [index, item] of items.entries()) {
    // biome-ignore lint/performance/noAwaitInLoops: the order sets each item's position.
    results.push(await run(item, index));
  }
  return results;
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    throw new Error(`Missing ${what}`);
  }
  return value;
}

function hasRule(unlock: UnlockInput): unlock is NonNullable<UnlockInput> {
  return unlock !== undefined && unlock.mode !== "none";
}

/** One activity (no rule), in a module or inside a sequence. */
function createOneActivity(
  moduleId: string,
  parentActivityId: string | null,
  input: StepInput | ActivityInput
): Promise<CreatedActivity> {
  switch (input.type) {
    case "quiz":
      return call(quiz.createWithQuestions, {
        moduleId,
        parentActivityId,
        questions: required(input.questions, "questions for the quiz"),
        title: input.title,
      });
    case "link":
      return call(activities.create, {
        moduleId,
        parentActivityId,
        title: input.title,
        type: "link",
        url: required(input.url, "url for the link"),
      });
    case "pdf":
      return call(activities.create, {
        filePath: required(input.filePath, "filePath for the PDF"),
        moduleId,
        parentActivityId,
        title: input.title,
        type: "pdf",
      });
    default:
      throw new Error(`Unknown activity type "${input.type}"`);
  }
}

/** A sequence's steps; locked in order, each after the first waits for the one before. */
function createSteps(input: ActivityInput, groupId: string) {
  return inOrder(
    required(input.steps, "steps for the sequence"),
    async (stepInput, index) => {
      const step = await createOneActivity(input.moduleId, groupId, stepInput);
      if (input.order === "lock" && index > 0) {
        await call(activities.setUnlockRule, {
          id: step.id,
          mode: "previous",
          requiredIds: [],
        });
      }
      return { id: step.id, title: step.title, type: step.type };
    }
  );
}

async function createActivity(input: ActivityInput) {
  const holdsOthers =
    input.type === "flashcard_deck" || input.type === "sequence";
  const activity = holdsOthers
    ? await call(activities.create, {
        moduleId: input.moduleId,
        title: input.title,
        type: input.type === "sequence" ? "group" : "flashcard_deck",
      })
    : await createOneActivity(input.moduleId, null, input);
  let steps: CreatedActivity[] = [];
  await orUndo(
    async () => {
      if (input.type === "flashcard_deck") {
        await inOrder(input.flashcards ?? [], (card) =>
          call(flashcards.create, { activityId: activity.id, ...card })
        );
      }
      if (input.type === "sequence") {
        steps = await createSteps(input, activity.id);
      }
      if (hasRule(input.unlock)) {
        await call(activities.setUnlockRule, {
          id: activity.id,
          mode: input.unlock.mode as "none",
          requiredIds: input.unlock.requiredIds,
        });
      }
    },
    () => call(activities.softDelete, { id: activity.id })
  );
  return { id: activity.id, steps, title: activity.title, type: activity.type };
}

async function createExam(input: z.infer<typeof examSchema>) {
  const exam = await call(exams.create, {
    moduleIds: input.moduleIds,
    passingScore: input.passingScore,
    programId: input.programId,
    questionCount: input.questionCount,
    timeLimitMinutes: input.timeLimitMinutes,
    title: input.title,
  });
  await orUndo(
    async () => {
      // Standalone questions: they belong to the exam only.
      await inOrder(input.questions ?? [], async (question) => {
        const created = await call(quiz.createQuestion, {
          examId: exam.id,
          text: question.text,
        });
        await inOrder(question.options, (option) =>
          call(quiz.createOption, { questionId: created.id, ...option })
        );
      });
      if (hasRule(input.unlock)) {
        await call(exams.setUnlockRule, {
          id: exam.id,
          mode: input.unlock.mode as "none",
          requiredIds: input.unlock.requiredIds,
        });
      }
    },
    () => call(exams.softDelete, { id: exam.id })
  );
  return { id: exam.id, title: exam.title };
}

async function createModule(input: {
  name: string;
  programId: string;
  unlock?: UnlockInput;
}) {
  const module = await call(modules.create, {
    name: input.name,
    programId: input.programId,
  });
  const { unlock } = input;
  if (hasRule(unlock)) {
    await orUndo(
      async () => {
        await call(modules.setUnlockRule, {
          id: module.id,
          mode: unlock.mode as "none",
          requiredIds: unlock.requiredIds,
        });
      },
      () => call(modules.softDelete, { id: module.id })
    );
  }
  return { id: module.id, name: module.name };
}

/** A program inside out, with the ids the create tools ask for. */
async function outlineProgram(programId: string) {
  const program = (await call(programs.list, undefined)).find(
    (item) => item.id === programId
  );
  if (!program) {
    throw new Error("The program does not exist");
  }
  const outlineActivity = async (
    moduleId: string,
    activity: { id: string; title: string; type: string; unlockMode: string }
  ) => {
    const isSequence = activity.type === "group";
    const steps = isSequence
      ? await call(activities.list, {
          moduleId,
          parentActivityId: activity.id,
        })
      : [];
    return {
      id: activity.id,
      steps: steps.map(({ id, title, type }) => ({ id, title, type })),
      title: activity.title,
      type: isSequence ? "sequence" : activity.type,
      unlockMode: activity.unlockMode,
    };
  };
  const moduleRows = await call(modules.list, { programId });
  const outlineModules = await Promise.all(
    moduleRows.map(async (module) => {
      const activityRows = await call(activities.list, {
        moduleId: module.id,
      });
      return {
        activities: await Promise.all(
          activityRows.map((activity) => outlineActivity(module.id, activity))
        ),
        id: module.id,
        name: module.name,
        unlockMode: module.unlockMode,
      };
    })
  );
  const examRows = await call(exams.list, { programId });
  return {
    exams: examRows.map((exam) => ({
      id: exam.id,
      passingScore: exam.passingScore,
      questionCount: exam.questionCount,
      title: exam.title,
      unlockMode: exam.unlockMode,
    })),
    id: program.id,
    modules: outlineModules,
    name: program.name,
  };
}

export function createBridgeRouter(onDataChanged: (topic: DataTopic) => void) {
  /** A procedure's result, after telling the open window what changed. */
  const thenChanged =
    (topic: DataTopic) =>
    <T>(result: T): T => {
      onDataChanged(topic);
      return result;
    };

  return {
    activities: {
      create: os
        .input(activitySchema)
        .handler(({ input }) =>
          withReason(() =>
            createActivity(input).then(thenChanged("activities"))
          )
        ),
    },
    exams: {
      create: os
        .input(examSchema)
        .handler(({ input }) =>
          withReason(() => createExam(input).then(thenChanged("exams")))
        ),
    },
    modules: {
      create: os
        .input(
          z.object({
            name: z.string().min(1),
            programId: z.string(),
            unlock: unlockSchema,
          })
        )
        .handler(({ input }) =>
          withReason(() => createModule(input).then(thenChanged("modules")))
        ),
    },
    programs: {
      create: os
        .input(createProgramInputSchema)
        .handler(({ input }) =>
          withReason(() =>
            call(programs.create, input).then(thenChanged("programs"))
          )
        ),
      list: programs.list,
      outline: os
        .input(z.object({ programId: z.string() }))
        .handler(({ input }) =>
          withReason(() => outlineProgram(input.programId))
        ),
    },
  };
}

export type BridgeRouter = ReturnType<typeof createBridgeRouter>;
