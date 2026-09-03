import {
  createFilesystemMiddleware,
  createSummarizationMiddleware,
  FilesystemBackend,
} from "deepagents";
import { mainModel, miniModel } from "../models";
import { z } from "zod";
import { createAgent, todoListMiddleware } from "langchain";

export const ScoutReportSchema = z.object({
  tldr: z
    .string()
    .describe(
      "A very short summary giving only the most important information. Minimal characters, maximum information",
    ),
  fullReport: z.string().describe("A detailed report of your findings."),
});

type ScoutReportSchemaType = z.infer<typeof ScoutReportSchema>;

export const ManagerContextSchema = z.object({
  origin_state_summary: ScoutReportSchema,
  target_state_summary: ScoutReportSchema,
  origin_tree: z.any(),
  target_tree: z.any(),
});

type ManagerContextSchemaType = z.infer<typeof ManagerContextSchema>;

export async function runDeepAgentScout(
  dir: string,
  task: string,
): Promise<ScoutReportSchemaType> {
  const backend = new FilesystemBackend({ rootDir: dir, virtualMode: false });

  // add RAG middleware
  const agent = createAgent({
    model: mainModel,
    middleware: [
      createSummarizationMiddleware({ model: miniModel, backend }),
      todoListMiddleware(),
      createFilesystemMiddleware({
        backend,
        tools: ["ls", "read_file", "grep", "glob"],
      }),
    ],
    responseFormat: ScoutReportSchema,
  });

  const response = await agent.invoke({
    messages: [
      {
        role: "user",
        content: `${task}`,
      },
    ],
  });

  return response.structuredResponse;
}

export async function runManagerAgent(
  task: string,
  context: ManagerContextSchemaType,
) {
  // add SCRUM-middleware and RAG-middleware
  const agent = createAgent({
    model: mainModel,
    middleware: [],
    contextSchema: ManagerContextSchema,
  });

  const response = await agent.invoke(
    {
      messages: [
        {
          role: "user",
          content: `${task}`,
        },
      ],
    },

    {
      context: context,
    },
  );

  return;
}
