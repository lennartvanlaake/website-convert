import {
  createFilesystemMiddleware,
  createSummarizationMiddleware,
  FilesystemBackend,
} from "deepagents";
import { mainModel, miniModel } from "../models";
import { z } from "zod";
import { createAgent, todoListMiddleware } from "langchain";

const ScoutReportSchema = z.object({
  tldr: z
    .string()
    .describe(
      "A very short summary giving only the most important information. Minimal characters, maximum information",
    ),
  fullReport: z.string().describe("A detailed report of your findings."),
});

type ScoutReportSchemaType = z.infer<typeof ScoutReportSchema>;

const summarizer = createSummarizationMiddleware({ model: miniModel, backend });

export async function runDeepAgentScout(
  dir: string,
  task: string,
): Promise<ScoutReportSchemaType> {
  const backend = new FilesystemBackend({ rootDir: dir, virtualMode: false });
  const agent = createAgent({
    model: mainModel,
    middleware: [
      summarizer,
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
