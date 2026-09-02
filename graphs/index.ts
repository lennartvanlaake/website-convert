import { z } from "zod";
import { StateGraph, START, END } from "@langchain/langgraph";

import { init_graph } from "./init.ts";

// Parent graph mirrors the subgraph's schema so the compiled subgraph shares
// its channels. No wrapper needed (shared-keys subgraph pattern).
const MainState = z.object({
  url: z.string(),
  project: z.string(),
  origin_dir: z.string().default(""),
  target_dir: z.string().default(""),
});

// Parent graph: construct from the subgraph's state schema so the compiled
// subgraph shares its channels. `init_graph` (a CompiledStateGraph) is passed
// straight to addNode — no wrapper needed (shared-keys subgraph pattern).
export const main_graph = new StateGraph(MainState)
  .addNode("subgraph", init_graph)
  .addEdge(START, "subgraph")
  .addEdge("subgraph", END)
  .compile();

await main_graph.invoke({ url: "https://example.com", project: "test" });
