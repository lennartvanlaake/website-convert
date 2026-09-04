import {
  createFilesystemMiddleware,
  createSummarizationMiddleware,
  FilesystemBackend,
} from "deepagents";
import { mainModel, miniModel } from "../models";
import { z } from "zod";
import {
  createAgent,
  summarizationMiddleware,
  todoListMiddleware,
} from "langchain";

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

function printContent(input: any) {
  if (input.content) {
    console.log(typeof input);
    console.log(input.content);
  } else {
    console.log(input);
  }
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

export async function runDeepAgentScout(
  dir: string,
  task: string,
): Promise<ScoutReportSchemaType> {
  const backend = new FilesystemBackend({ rootDir: dir, virtualMode: true });

  // add RAG middleware
  const agent = createAgent({
    model: mainModel,
    middleware: [
      summarizationMiddleware({
        model: miniModel,
        trigger: [{ tokens: 5000 }, { messages: 5 }],
        keep: { messages: 20 },
      }),
      createFilesystemMiddleware({
        backend,
        tools: ["ls", "read_file", "grep", "glob"],
      }),
    ],
    responseFormat: ScoutReportSchema,
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
      recursionLimit: 500,
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
      context: context,
      ...loggingCallbacks,
    },
  );

  return;
}
