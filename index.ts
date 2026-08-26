import {
  type GraphNode,
  StateGraph,
  START,
  END,
  Command,
} from "@langchain/langgraph";

import { $ } from "bun";
import z from "zod";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const StateDef = z.object({
  url: z.string(),
  project: z.string(),
});

type StateType = z.infer<typeof StateDef>;

const initNode: GraphNode<typeof StateDef> = async (state) => {
  const targetDir = `${import.meta.dir}/projects/${state.project}/original`;
  await $`mkdir -p ${targetDir}`;
  await $`wget --mirror --convert-links --adjust-extension --page-requisites --no-parent ${state.url} -P ${targetDir}`;
  return state;
};

async function checkNeedInit(state: StateType) {
  const targetDir = `${import.meta.dir}/projects/${state.project}/original`;
  const exists = existsSync(targetDir);
  const isNotEmpty = exists ? await readdir(targetDir) : false;
  console.log("It exists!");
  return new Command({
    goto: isNotEmpty ? END : initNode.name,
  });
}

const graph = new StateGraph(StateDef)

  .addNode(checkNeedInit.name, checkNeedInit, { ends: [initNode.name, END] })
  .addNode(initNode.name, initNode)
  .addEdge(START, checkNeedInit.name)
  .addEdge(initNode.name, END)
  .compile();

await graph.invoke({ url: "https://www.mvk.edu.in", project: "mvk" });
