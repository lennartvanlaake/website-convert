import {
  createFilesystemMiddleware,
  createSummarizationMiddleware,
  FilesystemBackend,
  StateBackend,
} from "deepagents";
import { mainModel, miniModel } from "../models";
import { z } from "zod";
import { createAgent, todoListMiddleware } from "langchain";
import { scoutTools } from "./tools";
import { $ } from "bun";

function printContent(input: any) {
  // if (input.content) {
  //   console.log(typeof input);
  //   console.log(input.content);
  // } else {
  console.log(input);
  // }
}

const loggingCallbacks = {
  callbacks: [
    {
      handleToolStart(_tool, input, _runId) {
        printContent(input);
      },
      handleToolEnd(output, _runId) {
        printContent(output);
      },
      handleChatModelStart(_model, messages, _runId) {
        printContent(messages);
      },
    },
  ],
};

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

export const ScoutContexSchema = z.object({
  fileTree: z.any(),
});

type ManagerContextSchemaType = z.infer<typeof ManagerContextSchema>;

export async function runScout(
  dir: string,
  task: string,
  originTree: any,
): Promise<ScoutReportSchemaType> {
  console.log(task);
  $.cwd(dir);

  // add RAG middleware
  const agent = createAgent({
    model: mainModel,
    tools: scoutTools,
    contextSchema: ScoutContexSchema,
    middleware: [
      // createSummarizationMiddleware({ model: miniModel, backend }),
      // todoListMiddleware(),
    ],
    responseFormat: ScoutReportSchema,
  });

  const response = await agent.invoke(
    {
      messages: [task],
    },
    {
      configurable: { thread_id: "1" },
      context: { fileTree: originTree },
      ...loggingCallbacks,
    },
  );

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
      context,
      ...loggingCallbacks,
    },
  );

  return;
}
