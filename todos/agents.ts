import {
  createTaskTool,
  createSubtaskTool,
  updateSubtaskStatusTool,
  updateSubtaskNotesTool,
} from "./tools.ts";
import { mainModel } from "../shared/models";
import { ToolLoopAgent } from "ai";
import { getNextSubtask, getNextTask } from "./crud.ts";
import { logger } from "../shared/utils.ts";

const managerSystemPrompt = `You are an expect delegator.
    You do not do work, you create tasks and subtaks with conside descriptions. Be terse, no fluff, politeness or exclamations. Simplify and shorten language use. Use the createTask and createSubtask tools for delegation`;

const workerSystemPrompt = `You are a worker. You focus on executing the subtask as quicly as possible. You are part of a team that is executing a larger task. Use this only as context, do NOT do work outside of your subtask. If asked or needed, use your "writeNotes" tool to report about your progress. If finished, change status to "done" using your changeSubtaskStatus tool`;

export async function runManagerAgent(task: string) {
  const agent = new ToolLoopAgent({
    model: mainModel,
    tools: { createTask: createTaskTool, createSubtask: createSubtaskTool },
    instructions: managerSystemPrompt,
  });

  return await agent.generate({ prompt: task });
}

// TODO handle statusses properly
export async function runWorkerAgent(
  specialTools: any = {},
  extraInstructions = "",
) {
  const task = getNextTask();

  if (!task) {
    logger.info("No task found, returning");
    return;
  }

  const subtask = getNextSubtask(task.id);

  if (!subtask) {
    logger.info("No subtask found, returning");
    return;
  }

  // add SCRUM-middleware and RAG-middleware
  const agent = new ToolLoopAgent({
    model: mainModel,
    tools: {
      updateSubtaskStatus: updateSubtaskStatusTool,
      updateSubtaskNotes: updateSubtaskNotesTool,
      ...specialTools,
    },
    instructions: workerSystemPrompt,
  });

  return await agent.generate({
    prompt: `The team is working on the larger task (CONTEXT ONLY): ${JSON.stringify(task)}. Your subtask is ${JSON.stringify(subtask)}. ${extraInstructions}`,
  });
}
