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

export const StateDef = z.object({
  url: z.string(),
  project: z.string(),
  originDir: z.string().default(""),
  targetDir: z.string().default(""),
});

type StateType = z.infer<typeof StateDef>;

function getBaseOriginDir(project: string) {
  return `${import.meta.dir}/projects/${project}/original`;
}

function getBaseTargetDir(project: string) {
  return `${import.meta.dir}/projects/${project}/target`;
}

const originalInitNode: GraphNode<typeof StateDef> = async (state) => {
  const originDir = getBaseOriginDir(state.project);
  await $`mkdir -p ${originDir}`;
  await $`wget --mirror --convert-links --adjust-extension --page-requisites --no-parent ${state.url} -P ${originDir}`;
  return state;
};

async function checkOriginNeedsInit(state: StateType) {
  const originDir = getBaseOriginDir(state.project);
  const exists = existsSync(originDir);
  const isNotEmpty = exists ? await readdir(originDir) : false;
  console.log("Origin exists");
  return new Command({
    goto: isNotEmpty ? checkTargetNeedsInit.name : originalInitNode.name,
  });
}

async function checkTargetNeedsInit(state: StateType) {
  const targetDir = getBaseTargetDir(state.project);
  const exists = existsSync(targetDir);
  const isNotEmpty = exists ? await readdir(targetDir) : false;
  if (isNotEmpty) {
    state.originDir;
  }
  return new Command({
    goto: isNotEmpty ? setDirectoriesNode.name : targetInitNode.name,
  });
}

const targetInitNode: GraphNode<typeof StateDef> = async (state) => {
  const targetDir = getBaseTargetDir(state.project);
  await $`mkdir -p ${targetDir}`;
  await $`cd ${targetDir}`;
  await $`git clone git@github.com:lennartvanlaake/hugolify-template.git`;
  return state;
};

const pullNode: GraphNode<typeof StateDef> = async (state) => {
  await $`cd ${state.targetDir} && git pull origin master`;
  return state;
};

const setDirectoriesNode: GraphNode<typeof StateDef> = async (state) => {
  const origin = (await $`ls ${getBaseOriginDir(state.project)}`).text();
  const target = (await $`ls ${getBaseTargetDir(state.project)}`).text();
  state.originDir = getBaseOriginDir(state.project) + "/" + origin;
  state.targetDir = getBaseTargetDir(state.project) + "/" + target;
  return state;
};

export const initGraph = new StateGraph(StateDef)
  .addNode(checkOriginNeedsInit.name, checkOriginNeedsInit, {
    ends: [originalInitNode.name, checkTargetNeedsInit.name],
  })
  .addNode(checkTargetNeedsInit.name, checkTargetNeedsInit, {
    ends: [targetInitNode.name, setDirectoriesNode.name],
  })
  .addNode(targetInitNode.name, targetInitNode)
  .addNode(originalInitNode.name, originalInitNode)
  .addNode(setDirectoriesNode.name, setDirectoriesNode)
  .addNode(pullNode.name, pullNode)

  .addEdge(START, checkOriginNeedsInit.name)
  .addEdge(originalInitNode.name, checkTargetNeedsInit.name)
  .addEdge(targetInitNode.name, setDirectoriesNode.name)
  .addEdge(setDirectoriesNode.name, pullNode.name)
  .addEdge(pullNode.name, END)
  .compile();
