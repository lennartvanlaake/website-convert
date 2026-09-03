import { type GraphNode, StateGraph, START, END } from "@langchain/langgraph";

import { $ } from "bun";
import z, { set } from "zod";
import { runDeepAgentScout, ScoutReportSchema } from "../agents/agents.ts";
import dirTree from "directory-tree";

export const StateDef = z.object({
  url: z.string(),
  project: z.string(),
  origin_dir: z.string().default(""),
  target_dir: z.string().default(""),
  origin_state_summary: ScoutReportSchema,
  target_state_summary: ScoutReportSchema,
  origin_tree: z.any(),
  target_tree: z.any(),
});

const scoutNode: GraphNode<typeof StateDef> = async (state) => {
  state.origin_state_summary = await runDeepAgentScout(
    state.origin_dir,
    `This directory contains a copy of a website. The over-all goal is to copy the look and content of this website precisely, but with a different CMS and therefore different code and page-structure. Explain the structure of the website, the features of the code and how the structure of the website relates to the structure of the folder. Take special note of anything that deserves special attention when copying the website's look, content and funcitonality (modals, iframes, custom code, etc). Be detailed, but avoid fluff and politeness No need to provide a tree of files, that is known`,
  );

  state.origin_tree = dirTree(state.origin_dir);

  state.target_state_summary = await runDeepAgentScout(
    state.origin_dir,
    `This directory contains a work-in-progress Astro-CMS project using SveltiaCMS meant to host a static website. Give a summary of what the content of the website is so far, which Collections are defined and generally the progress of making this a full website. Ignore the  scaffolding of AstroCMS and Sveltia, that is a given.`,
  );

  state.target_tree = dirTree(state.target_dir);
  return state;
};

export const init_graph = new StateGraph(StateDef)
  .addNode(scoutNode.name, scoutNode)
  .addEdge(START, scoutNode.name)
  .addEdge(scoutNode.name, END)
  .compile();

// await graph.invoke({ url: "https://www.mvk.edu.in", project: "mvk" });
