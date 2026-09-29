import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { $ } from "bun";
import z from "zod";

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

function directoryNotEmpty(dir: string) {
  if (!existsSync(dir)) return false;
  return (async () => (await readdir(dir)).length > 0)();
}

function checkOriginNeedsInit(state: StateType): boolean {
  return !directoryNotEmpty(getBaseOriginDir(state.project));
}

function checkTargetNeedsInit(state: StateType): boolean {
  // Run target init only when target is empty; a fresh clone means dirs are set.
  const targetDir = getBaseTargetDir(state.project);
  return existsSync(targetDir) ? !directoryNotEmpty(targetDir) : true;
}

export async function init(state: StateType): Promise<StateType> {
  if (checkOriginNeedsInit(state)) {
    const originDir = getBaseOriginDir(state.project);
    await $`mkdir -p ${originDir}`;
    await $`wget --mirror --convert-links --adjust-extension --page-requisites --no-parent ${state.url} -P ${originDir}`;
  }

  if (checkTargetNeedsInit(state)) {
    const targetDir = getBaseTargetDir(state.project);
    await $`mkdir -p ${targetDir}`;
    await $`cd ${targetDir}`;
    await $`git clone git@github.com:lennartvanlaake/hugolify-template.git`;
    state.targetDir = `${targetDir}`;
  }

  if (state.originDir === "") state.originDir = getBaseOriginDir(state.project);
  if (state.targetDir === "") state.targetDir = getBaseTargetDir(state.project);

  await $`cd ${state.targetDir} && git pull origin master`;
  return state;
}
