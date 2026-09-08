import { z } from "zod";
import { StateGraph, START, END } from "@langchain/langgraph";

import { initGraph } from "./init.ts";
import { planGraph } from "./plan.ts";

// Parent graph mirrors the subgraph's schema so the compiled subgraph shares
// its channels. No wrapper needed (shared-keys subgraph pattern).
const MainState = z.object({
  url: z.string(),
  project: z.string(),
  originDir: z.string().default(""),
  targetDir: z.string().default(""),
});

// Parent graph: construct from the subgraph's state schema so the compiled
// subgraph shares its channels. `init_graph` (a CompiledStateGraph) is passed
// straight to addNode — no wrapper needed (shared-keys subgraph pattern).

JSON.stringify(initGraph);
JSON.stringify(planGraph);
export const mainGraph = new StateGraph(MainState)
  .addNode("1", initGraph)
  .addNode("2", planGraph)
  .addEdge(START, "1")
  .addEdge("1", "2")
  .addEdge("2", END)
  .compile();

await mainGraph.invoke({
  url: "https://preview.astro.new/portfolio",
  project: "portfolio",
});
