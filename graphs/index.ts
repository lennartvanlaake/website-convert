import { z } from "zod";
import { StateGraph, START, END } from "@langchain/langgraph";

import { init_graph as initGraph } from "./init.ts";
import { planGraph } from "./plan.ts";
import { pl } from "zod/v4/locales";

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
export const main_graph = new StateGraph(MainState)
  .addNode(initGraph.name!!, initGraph)
  .addNode(planGraph.name!!, planGraph)
  .addEdge(START, initGraph.name!!)
  .addEdge(initGraph.name!!, planGraph.name!!)
  .addEdge(planGraph.name!!, END)
  .compile();

await initGraph.invoke({
  url: "https://preview.astro.new/portfolio",
  project: "portfolio",
});
