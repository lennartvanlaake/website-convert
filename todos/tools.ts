import { z } from "zod/v4";
import * as crud from "./crud";
import { tool } from "ai";
import { TASK_STATUSES } from "./constants";

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
    "Move a task (story) between states. Use during planning: 'todo' (planned, not started), 'in-progress' (being done now), 'blocked' (add reason in notes), 'done'",
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

export const updateTaskTool = tool({
  description:
    "Update fields of a task (story). Providing a field changes it; omit it to leave it unchanged. Empty string clears a text field.",
  inputSchema: z.object({
    taskId: z.string().describe("Task id to update."),
    title: z
      .string()
      .optional()
      .describe("New title. Omit to leave unchanged."),
    description: z
      .string()
      .optional()
      .describe("New description. Omit to leave unchanged."),
    status: z
      .string()
      .optional()
      .describe("New status. Omit to leave unchanged."),
    notes: z
      .string()
      .optional()
      .describe("New notes. Omit to leave unchanged."),
  }),
  outputSchema: z.object({
    error: z.string().nullable,
    changes: z.object({
      title: z.string(),
      description: z.string(),
      status: z.string(),
      notes: z.string(),
    }),
  }),
  execute: async ({ taskId, title, description, status, notes }) => {
    try {
      const before = await crud.getTask(taskId);
      if (!before) throw new Error(`Task with id ${taskId} does not exist`);
      const changes = {
        title: before.title,
        description: before.description,
        status: before.status,
        notes: before.notes,
      };

      if (title !== undefined) changes.title = title;
      if (description !== undefined) changes.description = description;
      if (status !== undefined) changes.status = status;
      if (notes !== undefined) changes.notes = notes;

      await crud.updateTask(taskId, changes);
      return { error: null, changes };
    } catch (e) {
      return { error: `error: ${(e as Error).message}` };
    }
  },
});

// ---- Subtask tools --------------------------------------------------------

export const createSubtaskTool = tool({
  description: "Create a subtask. Requires a taskId obtained by creating task.",
  inputSchema: z.object({
    title: z.string().min(1).describe("Subtask title."),
    description: z
      .string()
      .min(1)
      .describe(
        "Details of the step. Make this clear enough to be picked up by an LLM agent.",
      ),
    taskId: z.string().describe("Task id (uuid) this subtask belongs to."),
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

export const updateSubtaskWorkerTool = tool({
  description:
    "Update a subtask's status and notes in one call. Use to reflect daily work: 'todo' | 'in-progress' | 'done'. Empty notes clears the notes.",
  inputSchema: z.object({
    subtaskId: z.string().describe("Subtask id to update."),
    status: z
      .enum(TASK_STATUSES)
      .describe("New status: 'todo' | 'in-progress' | 'done'."),
    notes: z
      .string()
      .describe("New notes text. Empty string clears the notes."),
  }),
  outputSchema: z.object({
    error: z.string().nullable,
  }),
  execute: async ({ subtaskId, status, notes }) => {
    try {
      // empty-string notes = "no notes", so it does not overwrite the existing
      // handoff notes (which would otherwise make the manager's handoff prompt
      // dead and strand the worker on the same subtask forever).
      const changes = { status };
      if (notes && notes !== "") changes.notes = notes;

      await crud.updateSubtask(subtaskId, changes);
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

export const updateSubtaskManagerTool = tool({
  description:
    "Update a subtask's status and notes in one call. Use to reflect daily work: 'todo' | 'in-progress' | 'done'. Empty notes clears the notes.",
  inputSchema: z.object({
    subtaskId: z.string().describe("Subtask id to update."),
    status: z
      .enum(TASK_STATUSES)
      .describe("New status: 'todo' | 'in-progress' | 'done'."),
    title: z.string(),
    description: z.string(),
  }),
  outputSchema: z.object({
    error: z.string().nullable,
  }),
  execute: async ({ subtaskId, status, title, description }) => {
    try {
      const changes = {
        status: status,
        title: title,
        description: description,
      };

      await crud.updateSubtask(subtaskId, changes);
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
