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
import { DevToolsTelemetry } from "@ai-sdk/devtools";

export async function runManagerAgent(task: string) {
  const managerSystemPrompt = `You are an expect manager and delegator.
    You do not do work, you create tasks and subtaks with detailed
    but concise descriptions so your workers can execute them perfectly. Use the createTask and createSubtask tools for delegation`;

  // add SCRUM-middleware and RAG-middleware
  const agent = new ToolLoopAgent({
    model: mainModel,
    tools: { createTask: createTaskTool, createSubtask: createSubtaskTool },
    instructions: managerSystemPrompt,
    telemetry: {
      integrations: [DevToolsTelemetry() as any],
    },
  });

  return await agent.generate({ prompt: task });
}
