import { $ } from "bun";

// ponytail: thin wrappers over the 4 git commands. Each call returns text so
// the tool layer can format it; throwing on a non-zero exit lets the wrapper
// surface the real failure instead of swallowing it.

async function run(cmd: string, args: string[]): Promise<string> {
  try {
    const res = await $`git ${args}`;
    return (await res).text();
  } catch (e) {
    console.error(`git ${args.join(" ")} failed:`, e);
    throw e;
  }
}

export const gitDiff = async (): Promise<string> =>
  run("diff", ["--staged"]) + "\n" + run("diff", ["--"]);

export const gitAdd = async (): Promise<string> => run("add", ["-A"]);

export const gitCommit = async (
  message: string,
): Promise<string> => run("commit", ["-m", message]);

export const gitRevert = async (
  target: string,
): Promise<string> => run("revert", ["--no-commit", target]);
