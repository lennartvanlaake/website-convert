import {
  createTaskTool,
  createSubtaskTool,
  updateSubtaskWorkerTool,
} from "./tools.ts";
import { mainModel } from "../shared/models";
import { ToolLoopAgent } from "ai";
import { getNextSubtask, getNextTask } from "./crud.ts";
import { logger } from "../shared/utils.ts";
import { TaskStatus } from "./constants.ts";
import type { TasksRow } from "./schema.ts";

const managerSystemPrompt = `You are an expect delegator.
    You do not do work, you create tasks and subtaks with conside descriptions. Be terse, no fluff, politeness or exclamations. Simplify and shorten language use. Use the createTask and createSubtask tools for delegation`;

const workerSystemPrompt = `You are a worker. You focus on executing the subtask as quicly as possible. You are part of a team that is executing a larger task. Use this only as context, do NOT do work outside of your subtask. If asked or needed, use your "writeNotes" tool to report about your progress. If finished, change status to "done" using your changeSubtaskStatus tool`;

export async function createTasks(task: string) {
  const agent = new ToolLoopAgent({
    model: mainModel,
    tools: { createTask: createTaskTool, createSubtask: createSubtaskTool },
    instructions: managerSystemPrompt,
  });

  return await agent.generate({ prompt: task });
}

// TODO add replanning-function
// export async function reviewTasks() {
//   const agent = new ToolLoopAgent({
//     model: mainModel,
//     tools: {
//       createTask: createTaskTool,
//       createSubtask: createSubtaskTool,
//     },
//     instructions: managerSystemPrompt,
//   });
//   return await agent.generate();
// }

export async function doWork(
  task: TasksRow,
  specialTools: any = {},
  extraInstructions = "",
) {
  const subtask = getNextSubtask(task.id);

  if (!subtask) {
    logger.info("No subtask found, returning");
    return;
  }

  // add SCRUM-middleware and RAG-middleware
  const agent = new ToolLoopAgent({
    model: mainModel,
    tools: { updateSubtask: updateSubtaskWorkerTool, ...specialTools },
    instructions: workerSystemPrompt,
    prepareStep: async ({ messages, stepNumber }) => {
      if (stepNumber > 10) {
        return {
          messages: [
            ...messages,
            {
              role: "user",
              content:
                "You are taking too long. Either finish your task now or adjust status and write notes for the next worker",
            },
          ],
        };
      }
    },
  });

  const notesPrompt =
    subtask.status == TaskStatus.todo
      ? ""
      : `You are not the first worker to tackle this task. Status: ${subtask.status}. Notes: ${subtask.notes}.`;

  return await agent.generate({
    prompt: `The team is working on the larger task (CONTEXT ONLY): ${task.title} - ${task.description} ${task.notes}. Your subtask is ${subtask.title} - ${subtask.description}. ${notesPrompt}. ${extraInstructions}`,
  });
}

// TODO replan when loopCount gets > 10 (or whatever)
export async function managerWorkerLoop(taskPrompt: string) {
  let loopCount = 0;

  await createTasks(taskPrompt);
  let task = getNextTask();
  logger.info(task);

  while (task) {
    doWork(task);
    task = getNextTask();
    logger.info(task);
    loopCount++;
    if (loopCount > 10) {
      return;
    }
  }
}
