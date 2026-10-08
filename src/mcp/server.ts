import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PROGRAM_COLORS,
  PROGRAM_ICON_NAMES,
} from "@/constants/program-palette";
import {
  createBridgeClient,
  isAppUnreachable,
  readBridgeInfo,
} from "./bridge-client";

/**
 * Personare's MCP server (docs/specs/mcp-create-program.md): tools that turn
 * into calls to the open app's IPC handlers, through the bridge. It keeps no
 * data of its own and never opens the SQLite file.
 */

const APP_CLOSED = "Abra o Personare e tente de novo.";

function failure(text: string) {
  return { content: [{ text, type: "text" as const }], isError: true };
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
        "Cria um programa no Personare, o app de estudos aberto no computador. Um programa é uma área de estudo (um curso, uma matéria, um concurso); depois, módulos e atividades vão dentro dele. Devolve o id do programa criado.",
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
    async ({ color, icon, name }) => {
      const info = readBridgeInfo(dataDir);
      if (!info) {
        return failure(APP_CLOSED);
      }
      try {
        const program = await createBridgeClient(info).programs.create({
          color,
          icon,
          name,
        });
        return {
          content: [
            {
              text: `Programa “${program.name}” criado no Personare (id: ${program.id}).`,
              type: "text" as const,
            },
          ],
          structuredContent: { id: program.id, name: program.name },
        };
      } catch (error) {
        if (isAppUnreachable(error)) {
          return failure(APP_CLOSED);
        }
        return failure(
          `O Personare não criou o programa: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  return server;
}
