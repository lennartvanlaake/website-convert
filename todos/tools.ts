import { z } from "zod/v4";
import * as crud from "./crud";
import { tool } from "ai";

// Status vocabulary (Scrum-flavoured). These are the only accepted values; the
// zod enums below enforce them so the model can't invent statuses.
const TASK_STATUSES = ["todo", "in-progress", "done", "blocked"] as const;
const SUBTASK_STATUSES = ["todo", "in-progress", "done"] as const;
// ---- Task (story) tools ---------------------------------------------------

// NEW SCHEMA
export const createTaskTool = tool({
  description: "Create a task.",
  inputSchema: z.object({
    title: z.string().describe("Task title."),
    description: z.string().describe("Acceptance-relevant description."),
  }),

  execute: async ({ title, description }) => {
    try {
      const task = await crud.createTask({ title, description });
      return `Created task with id: ${task.id}`;
    } catch (e) {
      return `Failed to create task: ${(e as Error).message}`;
    }
  },
});

// // EVERYTHING BELOW IS OLD SCHEMA
export const updateTaskStatusTool = tool({
  description:
    "Move a task (story) between states. Use during planning: 'todo' (planned, not started), 'in-progress' (being done now), 'blocked' (impediment, use add_blocker), 'done'",
  inputSchema: z.object({
    taskId: z.number().describe("Task id to update."),
    status: z
      .enum(TASK_STATUSES)
      .describe("New status: 'todo' | 'in-progress' | 'blocked' | 'done'."),
  }),
  execute: async ({ taskId, status }) => {
    try {
      const task = await crud.updateTask(taskId, { status });
      if (!task) return `No task found with id ${taskId}.`;
      return `Task with id ${task.id} is now "${status}".`;
    } catch (e) {
      return `Failed to update task: ${(e as Error).message}`;
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
    taskId: z.number().describe("Task id this subtask belongs to."),
  }),
  execute: async ({ title, description, taskId }) => {
    // Validate the task exists so we never create an orphaned subtask.
    const task = crud.getTask(taskId);
    if (!task)
      throw new Error(`Task #${taskId} does not exist; create it first.`);
    try {
      const subtask = await crud.createSubtask({
        title,
        description,
        taskId,
      });
      return `Created subtask #${subtask.id}: "${subtask.title}" on task #${subtask.taskId}.`;
    } catch (e) {
      return `Failed to create subtask: ${(e as Error).message}`;
    }
  },
});

export const updateSubtaskStatusTool = tool({
  description:
    "Mark a subtask's progress. Use to reflect daily work: 'todo' | 'in-progress' | 'done'. All subtasks 'done' is a good signal the parent task is close.",
  inputSchema: z.object({
    subtaskId: z.number().describe("Subtask id to update."),
    status: z
      .enum(SUBTASK_STATUSES)
      .describe("New status: 'todo' | 'in-progress' | 'done'."),
  }),
  execute: async ({ subtaskId, status }) => {
    try {
      const subtask = await crud.updateSubtask(subtaskId, { status });
      if (!subtask) return `No subtask found with id ${subtaskId}.`;
      return `Subtask #${subtask.id} is now "${status}".`;
    } catch (e) {
      return `Failed to update subtask: ${(e as Error).message}`;
    }
  },
});
