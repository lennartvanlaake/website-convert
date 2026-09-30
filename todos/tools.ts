import { z } from "zod/v4";
import * as crud from "./crud";
import { tool } from "ai";

// Status vocabulary (Scrum-flavoured). These are the only accepted values; the
// zod enums below enforce them so the model can't invent statuses.
const TASK_STATUSES = ["todo", "in-progress", "done", "blocked"] as const;
const SUBTASK_STATUSES = ["todo", "in-progress", "done"] as const;
// ---- Task (story) tools ---------------------------------------------------

export const createTaskTool = tool({
  description: "Create a task. Returns uuid of task at `taskId` or `error`",
  inputSchema: z.object({
    title: z.string().describe("Task title."),
    description: z.string().describe("Acceptance-relevant description."),
  }),
  outputSchema: z.object({
    taskId: z.string(),
    error: z.string(),
  }),
  execute: async ({ title, description }) => {
    try {
      const task = await crud.createTask({ title, description });
      return { taskId: task.id, error: "" };
    } catch (e: any) {
      return { taskId: "", error: e.message };
    }
  },
});

export const updateTaskStatusTool = tool({
  description:
    "Move a task (story) between states. Use during planning: 'todo' (planned, not started), 'in-progress' (being done now), 'blocked' (impediment, use add_blocker), 'done'",
  inputSchema: z.object({
    taskId: z.string().describe("Task id to update."),
    status: z
      .enum(TASK_STATUSES)
      .describe("New status: 'todo' | 'in-progress' | 'blocked' | 'done'."),
  }),
  outputSchema: z.object({
    error: z.string().nullable,
  }),
  execute: async ({ taskId, status }) => {
    try {
      const task = await crud.updateTask(taskId, { status });
      if (!task) {
        return { error: `No task found with id ${taskId}.` };
      }
      return { error: null };
    } catch (e) {
      return { error: `error: ${(e as Error).message}` };
    }
  },
});

// ---- Subtask tools --------------------------------------------------------

export const createSubtaskTool = tool({
  description: "Create a subtask (a small concrete step inside a task)",
  inputSchema: z.object({
    title: z.string().min(1).describe("Subtask title."),
    description: z
      .string()
      .min(1)
      .describe(
        "Details of the step. Make this clear enough to be picked up by an LLM agent.",
      ),
    taskId: z.string().describe("Task id this subtask belongs to."),
  }),
  outputSchema: z.object({
    taskId: z.string().nullable(),
    subTaskId: z.string().nullable(),
    error: z.string().nullable(),
  }),
  execute: async ({ title, description, taskId }) => {
    // Validate the task exists so we never create an orphaned subtask.
    const task = crud.getTask(taskId);
    if (!task) {
      return {
        taskId,
        subTaskId: null,
        error: `task ${taskId} does not exist`,
      };
    }
    try {
      const subtask = await crud.createSubtask({
        title,
        description,
        taskId,
      });

      return { taskId, subTaskId: subtask.id, error: null };
    } catch (e: any) {
      return {
        taskId,
        subTaskId: null,
        error: `${e.message}`,
      };
    }
  },
});

export const updateSubtaskStatusTool = tool({
  description:
    "Mark a subtask's progress. Use to reflect daily work: 'todo' | 'in-progress' | 'done'. All subtasks 'done' is a good signal the parent task is close.",
  inputSchema: z.object({
    subtaskId: z.string().describe("Subtask id to update."),
    status: z
      .enum(SUBTASK_STATUSES)
      .describe("New status: 'todo' | 'in-progress' | 'done'."),
  }),
  outputSchema: z.object({
    error: z.string().nullable,
  }),
  execute: async ({ subtaskId, status }) => {
    try {
      const task = await crud.updateSubtask(subtaskId, { status });
      if (!task) {
        return { error: `No subtask found with id ${subtaskId}.` };
      }
      return { error: null };
    } catch (e) {
      return { error: `error: ${(e as Error).message}` };
    }
  },
});
