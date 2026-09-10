// WORK IN PROGRESS - DO NOT TOUCH THIS FILE
import { StateGraph, START, END } from "@langchain/langgraph";
import {
  createEpicTool,
  createTaskTool,
  updateTaskStatusTool,
  listEpicsWitdChildren,
} from "./tools";
import { mainModel } from "../models";
import z from "zod";
import { setupDatabase } from "./db";
import { getEpic, listEpics } from "./crud";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

const StateDef = z.object({
  epicId: z.number().default(0),
  epicTitle: z.string().default(""),
  epicDescription: z.string().default(""),
  // The worker bumps this each time it finishes a task; the loop exits once
  // no `todo` task remains. Starts at 0.
  doneCount: z.number().default(0),
  // Total task rows after the worker ran; the loop exits when it hits 0.
  remaining: z.number().default(0),
  dbPath: z.string().default(":memory:"),
});

type StateType = z.infer<typeof StateDef>;

let db: BunSQLiteDatabase;


function setupDbNode(state: StateType) {
  db = setupDatabase(state.dbPath)
  return state
}

// ---- nodes ---------------------------------------------------------------
// Ensure the epic row exists. If an epic with this id is already in the DB,
// keep it (and its title). Otherwise create it via the tool.
async function ensureEpicNode(state: StateType) {

  const db = setupDatabase(state.dbPath);
  const epic = await listEpics(db); 
  if (existing && existing.id > 0 && existing.title) {
    return { ...state, epicId: existing.id, epicTitle: existing.title };
  }
    await createEpic.invoke({
      title: state.epicTitle || `Epic #${state.epicId}`,
      description:
        state.epicDescription ||
        `Epic managed by assign_epic_worker (${state.epicId})`,
    }),
  if (!epicRow)
    throw new Error(
      `assign_epic_worker: failed to create epic #${state.epicId}`,
    );
  return {
    ...state,
    epicId: epicRow.id,
    epicTitle: epicRow.title,
    epicDescription: state.epicDescription || "",
  };
}

// Manager: if the epic has no tasks yet, synthesize one from the epic's
// title/description so there is work for the worker. The listing only exposes
// task titles/status, not descriptions, so derive it from the epic row.
async function managerNode(state: StateType) {
}

// Worker: pick the first `todo` task and drive it to `done`, then report the
// current status of every task so the edge can decide whether to loop.
//
// The worker model runs here: it inspects the selected task and calls the
// todos tools to complete it (move it in-progress, do the work, set it done),
// then bumps doneCount. Re-invoke the subgraph to run it again for the next
// task.
async function workerNode(state: StateType) {
}

// ---- graph ---------------------------------------------------------------

export const assignEpicWorkerGraph = new StateGraph(StateDef)
  .addNode(setupDbNode.name, setupDbNode)
  .addNode("ensure_epic", ensureEpicNode)
  .addNode("manager", managerNode)
  .addNode("worker", workerNode)
  // ensure -> manager -> worker, then loop back to the worker while the
  // worker reports remaining > 0; exit when every task is finished.
  .addEdge(START, setupDbNode)
  "ensure_epic")
  .addEdge("ensure_epic", "manager")
  .addEdge("manager", "worker")
  .addConditionalEdges("worker", (s: StateType) =>
    s.remaining === 0 ? END : "worker",
  )
  .compile();
