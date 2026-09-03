import { tool, type StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../db";
import * as crud from "../crud";

// ponytail: structured tools so the schema is exposed to the model (name,
// description, typed params) — this is what DynamicStructuredTool / tool()
// build on top of. Zod gives validation + free JSON-schema for the agent.

// ponytail: crud.* take a BunSQLiteDatabase instance; the tools read the
// shared module-level `db` from ../db (not a captured const). A `let` so tests
// can re-point it at a fresh :memory: DB via setupDatabase(); production calls
// setupDatabase("./todos.db") once at startup.
// typed as the drizzle client shape crud.* expects

// Status vocabulary (Scrum-flavoured). These are the only accepted values; the
// zod enums below enforce them so the model can't invent statuses.
const EPIC_STATUSES = ["backlog", "in-progress", "done"] as const;
const TASK_STATUSES = ["todo", "in-progress", "done", "blocked"] as const;
const SUBTASK_STATUSES = TASK_STATUSES;

// ---- Epic tools -----------------------------------------------------------

// One read tool spanning epics + tasks + subtasks + blockers. An agent managing
// a hierarchy wants the full shape at a glance; a separate listEpics would
// force N extra calls to assemble the tree.
export const listEpicsWithChildren = tool(
  async ({ epicId, limit }: { epicId?: number; limit?: number }) => {
    try {
      const rows = epicId
        ? await crud.getEpicChildren(db, epicId, limit)
        : await crud.getAllEpics(db);
      const out = rows
        .map((r) => {
          const taskIds =
            r.kind === "task"
              ? {
                  subtaskIds: (r.subtaskIds ?? []).filter((s) => s > 0),
                  blockerIds: (r.blockerIds ?? []).filter((b) => b > 0),
                }
              : undefined;
          const subtasks: { id: number; title: string; status: string }[] = (
            taskIds?.subtaskIds ?? []
          ).map((id: number) => ({ id, title: "", status: "" }));
          const blockers: { id: number; title: string; status: string }[] = (
            taskIds?.blockerIds ?? []
          ).map((id: number) => ({ id, title: "", status: "" }));
          return {
            kind: r.kind,
            id: r.id,
            title: r.title,
            status: r.status ?? null,
            ...(r.kind === "task" ? { epicId: r.epicId } : {}),
            blockers,
            subtasks,
          };
        })
        .filter((r) => r !== undefined);
      return `Epics: ${rows.length}. ${
        out
          .map((r) => `${r.kind}#${r.id} ${r.title} [${r.status ?? "—"}]`)
          .join("; ") || "(none)"
      }`;
    } catch (e) {
      // ponytail: expose the real error, don't hide it behind a generic
      // string so the caller can see what broke.
      console.error("list_epics_with_children failed:", e);
      throw e;
    }
  },
  {
    name: "list_epics_with_children",
    description:
      "List epics and, optionally, their full task/subtask/blocker tree. Use first to see the current plan before creating or updating anything.",
    schema: z.object({
      epicId: z
        .number()
        .optional()
        .describe(
          "Optional epic id. When given, returns that epic plus its tasks, subtasks and blockers (the hierarchy). When omitted, returns top-level epics only.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Optional cap on how many rows to return."),
    }),
  },
);

export const createEpicTool = tool(
  async ({ title, description }: { title: string; description: string }) => {
    try {
      const epic = await crud.createEpic(db, { title, description });
      return `Created epic #${epic.id}: "${epic.title}".`;
    } catch (e) {
      // Re-throw so callers/tests see the real error instead of a masked string.
      throw e;
    }
  },
  {
    name: "create_epic",
    description:
      "Create a new epic (a large initiative spanning multiple sprints). Use when a broad goal needs to be broken down into tasks and subtasks.",
    schema: z.object({
      title: z.string().min(1).describe("Epic title."),
      description: z
        .string()
        .min(1)
        .describe("What the epic delivers and why."),
    }),
  },
);

export const updateEpicStatusTool = tool(
  async ({
    epicId,
    status,
  }: {
    epicId: number;
    status: (typeof EPIC_STATUSES)[number];
  }) => {
    try {
      const epic = await crud.updateEpic(db, epicId, { status });
      if (!epic) return `No epic found with id ${epicId}.`;
      return `Epic #${epic.id} is now "${status}".`;
    } catch (e) {
      return `Failed to update epic: ${(e as Error).message}`;
    }
  },
  {
    name: "update_epic_status",
    description:
      "Move an epic between Scrum states. Use at sprint boundaries: 'backlog' (not started), 'in-progress' (being worked this sprint), 'done' (complete).",
    schema: z.object({
      epicId: z.number().describe("Epic id to update."),
      status: z
        .enum(EPIC_STATUSES)
        .describe("New status. 'backlog' -> 'in-progress' -> 'done'."),
    }),
  },
);

// ---- Task (story) tools ---------------------------------------------------

export const createTaskTool = tool(
  async ({
    title,
    description,
    epicId,
  }: {
    title: string;
    description: string;
    epicId: number;
  }) => {
    try {
      // Validate the epic exists so we never create an orphaned task.
      const epic = await crud.getEpic(db, epicId);
      if (!epic) return `Epic #${epicId} does not exist; create it first.`;
      const task = await crud.createTask(db, { title, description, epicId });
      return `Created task #${task.id}: "${task.title}" on epic #${task.epicId}.`;
    } catch (e) {
      return `Failed to create task: ${(e as Error).message}`;
    }
  },
  {
    name: "create_task",
    description:
      "Create a task (a user story — sprint-sized work delivering usable value). Requires a valid epicId. Use to slice an epic into deliverable units, then break each into subtasks.",
    schema: z.object({
      title: z.string().min(1).describe("Task title."),
      description: z
        .string()
        .min(1)
        .describe("Acceptance-relevant description."),
      epicId: z.number().describe("Id of the epic this task belongs to."),
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
      const task = await crud.updateTask(db, taskId, { status });
      if (!task) return `No task found with id ${taskId}.`;
      return `Task #${task.id} is now "${status}".`;
    } catch (e) {
      return `Failed to update task: ${(e as Error).message}`;
    }
  },
  {
    name: "update_task_status",
    description:
      "Move a task (story) between Scrum states. Use during sprint planning/daily scrum: 'todo' (planned, not started), 'in-progress' (being done now), 'blocked' (impediment, use add_blocker), 'done' (meets DoD).",
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
    try {
      const task = await crud.getTask(db, taskId);
      if (!task)
        throw new Error(`Task #${taskId} does not exist; create it first.`);
      const subtask = await crud.createSubtask(db, {
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
    description:
      "Create a subtask (a small concrete step inside a task). Use to decompose a task into actionable checkboxes the team checks off daily.",
    schema: z.object({
      title: z.string().min(1).describe("Subtask title."),
      description: z.string().min(1).describe("Details of the step."),
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
      const subtask = await crud.updateSubtask(db, subtaskId, { status });
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

// ---- Blocker (impediment) tools ------------------------------------------

export const addBlockerTool = tool(
  async ({
    taskId,
    title,
    description,
  }: {
    taskId: number;
    title: string;
    description: string;
  }) => {
    try {
      const task = await crud.getTask(db, taskId);
      if (!task)
        throw new Error(`Task #${taskId} does not exist; create it first.`);
      const blocker = await crud.createBlocker(db, {
        title,
        description,
        taskId,
      });
      return `Logged blocker #${blocker.id}: "${blocker.title}" on task #${blocker.taskId}.`;
    } catch (e) {
      return `Failed to add blocker: ${(e as Error).message}`;
    }
  },
  {
    name: "add_blocker",
    description:
      "Record a blocker/impediment on a task (the Scrum 'impediments' part of the Scrum Master's role). Use when a task hits 'blocked' status and something is in the way.",
    schema: z.object({
      taskId: z.number().describe("Task id that is blocked."),
      title: z.string().min(1).describe("Short blocker title."),
      description: z
        .string()
        .min(1)
        .describe("What's blocking and what unblocks it."),
    }),
  },
);

// ponytail: Object.values over a literal keeps insert order and reads as intent.
export const scrumTools = Object.values({
  list_epics_with_children: listEpicsWithChildren,
  create_epic: createEpicTool,
  update_epic_status: updateEpicStatusTool,
  create_task: createTaskTool,
  update_task_status: updateTaskStatusTool,
  create_subtask: createSubtaskTool,
  update_subtask_status: updateSubtaskStatusTool,
  add_blocker: addBlockerTool,
}) as Record<string, StructuredTool & { schema: z.ZodObject<any> }>;

export default listEpicsWithChildren;
