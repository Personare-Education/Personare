import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ORPCError } from "@orpc/client";
import { z } from "zod";
import {
  PROGRAM_COLORS,
  PROGRAM_ICON_NAMES,
} from "@/constants/program-palette";
import {
  type BridgeClient,
  createBridgeClient,
  isAppUnreachable,
  readBridgeInfo,
} from "./bridge-client";

/**
 * Personare's MCP server (docs/specs/mcp-create-program.md,
 * docs/specs/mcp-content-tools.md): tools that turn into calls to the open
 * app's IPC handlers, through the bridge. It keeps no data of its own and
 * never opens the SQLite file.
 */

const APP_CLOSED = "Abra o Personare e tente de novo.";

interface ToolResult {
  content: { text: string; type: "text" }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  [key: string]: unknown;
}

function failure(text: string): ToolResult {
  return { content: [{ text, type: "text" }], isError: true };
}

function success(
  text: string,
  structuredContent: Record<string, unknown>
): ToolResult {
  return { content: [{ text, type: "text" }], structuredContent };
}

/** Why the app said no, with each invalid field when it is the input. */
function reasonOf(error: unknown): string {
  if (error instanceof ORPCError) {
    const issues = (
      error.data as
        | { issues?: { message: string; path?: (string | number)[] }[] }
        | undefined
    )?.issues;
    if (issues?.length) {
      return issues
        .map(
          (issue) =>
            `${(issue.path ?? []).join(".") || "input"}: ${issue.message}`
        )
        .join("; ");
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Calls the open app through the bridge, or says to open it. */
async function withBridge(
  dataDir: string,
  run: (client: BridgeClient) => Promise<ToolResult>
): Promise<ToolResult> {
  const info = readBridgeInfo(dataDir);
  if (!info) {
    return failure(APP_CLOSED);
  }
  try {
    return await run(createBridgeClient(info));
  } catch (error) {
    if (isAppUnreachable(error)) {
      return failure(APP_CLOSED);
    }
    return failure(`O Personare recusou: ${reasonOf(error)}`);
  }
}

// ---------- shared input pieces ----------

const questionInput = z.object({
  options: z
    .array(z.object({ is_correct: z.boolean(), text: z.string().min(1) }))
    .min(2)
    .describe(
      "As alternativas, pelo menos duas; exatamente uma com is_correct: true."
    ),
  text: z
    .string()
    .min(1)
    .describe("O enunciado, em Markdown (aceita LaTeX: $x^2$)."),
});

function toQuestions(questions: z.infer<typeof questionInput>[] | undefined) {
  return questions?.map((question) => ({
    options: question.options.map((option) => ({
      isCorrect: option.is_correct,
      text: option.text,
    })),
    text: question.text,
  }));
}

function unlockInput<const T extends readonly [string, ...string[]]>(
  modes: T,
  explanation: string
) {
  return z
    .object({
      mode: z.enum(modes).describe(explanation),
      required_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Os ids que a regra espera, quando o modo pede uma lista (all, any, exam)."
        ),
    })
    .optional()
    .describe("A regra de desbloqueio. Sem ela, fica livre.");
}

function toUnlock(
  unlock: { mode: string; required_ids?: string[] } | undefined
) {
  return (
    unlock && { mode: unlock.mode, requiredIds: unlock.required_ids ?? [] }
  );
}

const stepInput = z.object({
  file_path: z
    .string()
    .optional()
    .describe("Para um PDF: o caminho do arquivo no computador."),
  questions: z
    .array(questionInput)
    .optional()
    .describe("Para um quiz: as perguntas."),
  title: z.string().min(1),
  type: z.enum(["link", "pdf", "quiz"]),
  url: z.string().optional().describe("Para um link: o endereço."),
});

function toStep(step: z.infer<typeof stepInput>) {
  return {
    filePath: step.file_path,
    questions: toQuestions(step.questions),
    title: step.title,
    type: step.type,
    url: step.url,
  };
}

export function createPersonareMcpServer({
  dataDir,
}: {
  dataDir: string;
}): McpServer {
  const server = new McpServer({ name: "personare", version: "0.1.0" });

  server.registerTool(
    "create_program",
    {
      description:
        "Cria um programa no Personare, o app de estudos aberto no computador. Um programa é uma área de estudo (um curso, uma matéria, um concurso); depois, módulos, atividades e provas vão dentro dele. Devolve o id do programa criado.",
      inputSchema: {
        color: z
          .string()
          .optional()
          .describe(
            `A cor do programa, em hexadecimal. Uma destas: ${PROGRAM_COLORS.join(", ")}.`
          ),
        icon: z
          .string()
          .optional()
          .describe(
            `O ícone do programa, pelo nome. Um destes: ${PROGRAM_ICON_NAMES.join(", ")}.`
          ),
        name: z
          .string()
          .min(1)
          .describe(
            "O nome do programa, como o aluno o chama (ex.: Cálculo I)."
          ),
      },
      title: "Criar programa",
    },
    ({ color, icon, name }) =>
      withBridge(dataDir, async (client) => {
        const program = await client.programs.create({ color, icon, name });
        return success(
          `Programa “${program.name}” criado no Personare (id: ${program.id}).`,
          { id: program.id, name: program.name }
        );
      })
  );

  server.registerTool(
    "list_programs",
    {
      description:
        "Lista os programas do Personare, com o id de cada um, para achar um programa que já existe.",
      inputSchema: {},
      title: "Listar programas",
    },
    () =>
      withBridge(dataDir, async (client) => {
        const programs = (await client.programs.list()).map((program) => ({
          id: program.id,
          name: program.name,
        }));
        const lines = programs.map(
          (program) => `- ${program.name} (id: ${program.id})`
        );
        return success(
          lines.length ? lines.join("\n") : "Ainda não há programas.",
          { programs }
        );
      })
  );

  server.registerTool(
    "get_program",
    {
      description:
        "Mostra um programa por dentro: os módulos (na ordem, com a regra de desbloqueio), as atividades de cada módulo (com os passos das sequências) e as provas, cada um com o id que as ferramentas de criar pedem.",
      inputSchema: {
        program_id: z
          .string()
          .describe("O id do programa (de list_programs ou create_program)."),
      },
      title: "Ver programa",
    },
    ({ program_id }) =>
      withBridge(dataDir, async (client) => {
        const outline = await client.programs.outline({
          programId: program_id,
        });
        return success(JSON.stringify(outline, null, 2), outline);
      })
  );

  server.registerTool(
    "create_module",
    {
      description:
        "Cria um módulo (um tema, uma unidade, um capítulo) no fim de um programa do Personare. Pode ter uma regra de desbloqueio: o módulo e as atividades dele ficam trancados até ela ser cumprida.",
      inputSchema: {
        name: z.string().min(1).describe("O nome do módulo."),
        program_id: z.string().describe("O id do programa."),
        unlock: unlockInput(
          ["none", "previous", "all", "any", "exam"] as const,
          "none: livre. previous: depois de tudo o que vem antes dele. all/any: depois de todos/qualquer um dos módulos em required_ids (do mesmo programa). exam: depois de passar na prova em required_ids (uma só)."
        ),
      },
      title: "Criar módulo",
    },
    ({ name, program_id, unlock }) =>
      withBridge(dataDir, async (client) => {
        const module = await client.modules.create({
          name,
          programId: program_id,
          unlock: toUnlock(unlock),
        });
        return success(
          `Módulo “${module.name}” criado (id: ${module.id}).`,
          module
        );
      })
  );

  server.registerTool(
    "create_activity",
    {
      description:
        "Cria uma atividade num módulo do Personare: um link, um PDF, um quiz (com as perguntas), um baralho de flashcards (com os cards) ou uma sequência (links, PDFs e quizzes feitos numa ordem e revisados juntos). Cada atividade volta para revisão no dia certo. Pode ter uma regra de desbloqueio.",
      inputSchema: {
        file_path: z
          .string()
          .optional()
          .describe("Para type pdf: o caminho do arquivo PDF no computador."),
        flashcards: z
          .array(
            z.object({ back: z.string().min(1), front: z.string().min(1) })
          )
          .optional()
          .describe(
            "Para type flashcard_deck: os cards (frente e verso, em Markdown)."
          ),
        module_id: z.string().describe("O id do módulo."),
        order: z
          .enum(["lock", "suggest"])
          .optional()
          .describe(
            "Para type sequence: lock trava na ordem (cada passo espera o anterior); suggest só sugere."
          ),
        questions: z
          .array(questionInput)
          .optional()
          .describe("Para type quiz: as perguntas (pelo menos uma)."),
        steps: z
          .array(stepInput)
          .optional()
          .describe(
            "Para type sequence: os passos, na ordem (links, PDFs e quizzes)."
          ),
        title: z.string().min(1).describe("O título da atividade."),
        type: z.enum(["link", "pdf", "quiz", "flashcard_deck", "sequence"]),
        unlock: unlockInput(
          ["none", "previous", "all", "any"] as const,
          "none: livre. previous: depois de tudo o que vem antes dela. all/any: depois de todas/qualquer uma das atividades em required_ids (do mesmo programa)."
        ),
        url: z.string().optional().describe("Para type link: o endereço."),
      },
      title: "Criar atividade",
    },
    (input) =>
      withBridge(dataDir, async (client) => {
        const activity = await client.activities.create({
          filePath: input.file_path,
          flashcards: input.flashcards,
          moduleId: input.module_id,
          order: input.order,
          questions: toQuestions(input.questions),
          steps: input.steps?.map(toStep),
          title: input.title,
          type: input.type,
          unlock: toUnlock(input.unlock),
          url: input.url,
        });
        const steps = activity.steps.length
          ? ` com ${activity.steps.length} passos`
          : "";
        return success(
          `Atividade “${activity.title}” criada${steps} (id: ${activity.id}).`,
          activity
        );
      })
  );

  server.registerTool(
    "create_exam",
    {
      description:
        "Cria uma prova num programa do Personare. A prova sorteia perguntas dos quizzes dos módulos escolhidos (só módulos com quiz), além das perguntas avulsas, que são só dela. Pode ter uma regra de desbloqueio.",
      inputSchema: {
        module_ids: z
          .array(z.string())
          .min(1)
          .describe(
            "Os módulos de onde sortear; cada um precisa ter um quiz com perguntas."
          ),
        passing_score: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("A nota para passar, em %. Sem ela, 70."),
        program_id: z.string().describe("O id do programa."),
        question_count: z
          .number()
          .int()
          .min(1)
          .describe("Quantas perguntas sortear dos módulos."),
        questions: z
          .array(questionInput)
          .optional()
          .describe("Perguntas avulsas, só desta prova."),
        time_limit_minutes: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("O tempo limite, em minutos. Sem ele, sem limite."),
        title: z.string().min(1).describe("O título da prova."),
        unlock: unlockInput(
          ["none", "sources", "all", "any", "exam"] as const,
          "none: livre. sources: depois de terminar os módulos de onde sorteia. all/any: depois de todos/qualquer um dos módulos em required_ids. exam: depois de passar na prova em required_ids (uma só, outra)."
        ),
      },
      title: "Criar prova",
    },
    (input) =>
      withBridge(dataDir, async (client) => {
        const exam = await client.exams.create({
          moduleIds: input.module_ids,
          passingScore: input.passing_score,
          programId: input.program_id,
          questionCount: input.question_count,
          questions: toQuestions(input.questions),
          timeLimitMinutes: input.time_limit_minutes ?? null,
          title: input.title,
          unlock: toUnlock(input.unlock),
        });
        return success(`Prova “${exam.title}” criada (id: ${exam.id}).`, exam);
      })
  );

  return server;
}
