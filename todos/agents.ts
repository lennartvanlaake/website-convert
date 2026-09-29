import { createTaskTool, createSubtaskTool } from "./tools.ts";
import { mainModel } from "../shared/models";
import { z } from "zod";
import { $ } from "bun";
import { Output, ToolLoopAgent } from "ai";
import {
  grepRecursive,
  ls,
  readLines,
  searchHtml,
  simplifyHtml,
  wc,
} from "../shared/tools";

export const ScoutReportSchema = z.object({
  tldr: z
    .string()
    .describe(
      "A very short summary giving only the most important information. Minimal characters, maximum information",
    ),
  fullReport: z.string().describe("A detailed report of your findings."),
});

type ScoutReportSchemaType = z.infer<typeof ScoutReportSchema>;

export async function runManagerAgent(task: string) {
  // add SCRUM-middleware and RAG-middleware
  const agent = new ToolLoopAgent({
    model: mainModel,
    tools: { createTask: createTaskTool, createSubtask: createSubtaskTool },
  });

  // await agent.invoke(
  //   {
  //     messages: [
  //       {
  //         role: "system",
  //         content:
  //           "You are an expect manager and delegator. You do not do work, you create tasks and subtaks with detailed but concise descriptions so your workers can execute them perfectly. Be transparent about your thought-process - explain it to me.",
  //       },
  //       {
  //         role: "user",
  //         content: `${task}`,
  //       },
  //     ],
  //   },
  //   {
  //   },
  // );
}

export async function runScout(
  dir: string,
  task: string,
  originTree: any,
): Promise<ScoutReportSchemaType> {
  $.cwd(dir);

  const agent = new ToolLoopAgent({
    model: mainModel,
    tools: { wc, simplifyHtml, ls, readLines, searchHtml, grepRecursive },
    output: Output.object({ schema: ScoutReportSchema }),
  });

  const response = await agent.invoke(
    {
      messages: [task],
    },
    {
      configurable: { thread_id: crypto.randomUUID() },
      context: { fileTree: originTree },
      ...loggingCallbacks,
    },
  );

  return response.structuredResponse;
}
