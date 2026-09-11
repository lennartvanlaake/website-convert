// WORK IN PROGRESS - DO NOT TOUCH THIS FILE
import { StateGraph, START, END } from "@langchain/langgraph";
import { mainModel } from "../models";
import z from "zod";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

const StateDef = z.object({
  prompt: z.string().default(""),
  taskId: z.number()
});

type StateType = z.infer<typeof StateDef>;


// ---- nodes ---------------------------------------------------------------

// split 
async function ensureEpicNode(state: StateType) {

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
