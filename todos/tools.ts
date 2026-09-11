import { tool, type StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as crud from "./crud";

// ponytail: structured tools so the schema is exposed to the model (name,
// description, typed params) — this is what DynamicStructuredTool / tool()
// build on top of. Zod gives validation + free JSON-schema for the agent.

// Status vocabulary (Scrum-flavoured). These are the only accepted values; the
// zod enums below enforce them so the model can't invent statuses.
const TASK_STATUSES = ["todo", "in-progress", "done", "blocked"] as const;
const SUBTASK_STATUSES = TASK_STATUSES;

// ---- Task (story) tools ---------------------------------------------------

export const createTaskTool = tool(
  async ({ title, description }: { title: string; description: string }) => {
    try {
      const task = await crud.createTask({ title, description });
      return `Created task with id: ${task.id}".`;
    } catch (e) {
      return `Failed to create task: ${(e as Error).message}`;
    }
  },
  {
    name: "create_task",
    description: "Create a task.",
    schema: z.object({
      title: z.string().min(1).describe("Task title."),
      description: z
        .string()
        .min(1)
        .describe("Acceptance-relevant description."),
    }),
  },
);

export const updateTaskStatusTool = tool(
  async ({
    taskId,
    status,
  }: {
    taskId: number;
    status: (typeof TASK_STATUSES)[number];
  }) => {
    try {
      const task = await crud.updateTask(taskId, { status });
      if (!task) return `No task found with id ${taskId}.`;
      return `Task with id ${task.id} is now "${status}".`;
    } catch (e) {
      return `Failed to update task: ${(e as Error).message}`;
    }
  },
  {
    name: "update_task_status",
    description:
      "Move a task (story) between states. Use during planning: 'todo' (planned, not started), 'in-progress' (being done now), 'blocked' (impediment, use add_blocker), 'done'",
    schema: z.object({
      taskId: z.number().describe("Task id to update."),
      status: z
        .enum(TASK_STATUSES)
        .describe("New status: 'todo' | 'in-progress' | 'blocked' | 'done'."),
    }),
  },
);

// ---- Subtask tools --------------------------------------------------------

export const createSubtaskTool = tool(
  async ({
    title,
    description,
    taskId,
  }: {
    title: string;
    description: string;
    taskId: number;
  }) => {
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
  {
    name: "create_subtask",
    description: "Create a subtask (a small concrete step inside a task)",
    schema: z.object({
      title: z.string().min(1).describe("Subtask title."),
      description: z
        .string()
        .min(1)
        .describe(
          "Details of the step. Make this clear enough to be picked up by an LLM agent.",
        ),
      taskId: z.number().describe("Task id this subtask belongs to."),
    }),
  },
);

export const updateSubtaskStatusTool = tool(
  async ({
    subtaskId,
    status,
  }: {
    subtaskId: number;
    status: (typeof SUBTASK_STATUSES)[number];
  }) => {
    try {
      const subtask = await crud.updateSubtask(subtaskId, { status });
      if (!subtask) return `No subtask found with id ${subtaskId}.`;
      return `Subtask #${subtask.id} is now "${status}".`;
    } catch (e) {
      return `Failed to update subtask: ${(e as Error).message}`;
    }
  },
  {
    name: "update_subtask_status",
    description:
      "Mark a subtask's progress. Use to reflect daily work: 'todo' | 'in-progress' | 'done'. All subtasks 'done' is a good signal the parent task is close.",
    schema: z.object({
      subtaskId: z.number().describe("Subtask id to update."),
      status: z
        .enum(SUBTASK_STATUSES)
        .describe("New status: 'todo' | 'in-progress' | 'done'."),
    }),
  },
);
