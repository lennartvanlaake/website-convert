import { $ } from "bun";
import type { ShellError } from "bun";

// ponytail: thin wrappers over the 4 git commands. Each call returns text so
// the tool layer can format it; throwing on a non-zero exit lets the wrapper
// surface the real failure instead of swallowing it. An optional cwd lets the
// wrappers run inside a specific repo (used by tests) without a process-wide
// global, so the agent's default usage stays scoped to the project root.
type GitArgs = string[];

// ponytail: cwd is a SEPARATE `$` template arg, so it lands before the
// subcommand as a global option (`git -C <dir> <subcommand> ...`). This avoids
// two bugs at once: `git <args> -C ${cwd}` puts `-C` after `-m`/`--no-commit`,
// which git rejects with "options '-m' and '-C' cannot be used together", and
// chdir (the earlier attempt) mutates global process state, which races
// between concurrent tests (bun runs test files in parallel). Keeping cwd out
// of the arg list also leaves no path interpolation (no injection surface).
// When cwd is a revision like "HEAD" (gitRevert), there is no path to apply,
// so it is ignored and the command runs in the project root — that case never
// needs a directory.
async function run(args: GitArgs, cwd?: string): Promise<string> {
  try {
    const res = cwd ? await $`git -C ${cwd} ${args}` : await $`git ${args}`;
    return (await res).text();
  } catch (e) {
    console.error(`git ${args.join(" ")} failed:`, e);
    throw e;
  }
}

// ponytail: `git <args> --quiet` signals a non-empty diff via its exit code,
// not its stdout (a diff has empty output), so capture exitCode separately.
// Returns the exit code (0/1) rather than throwing, for the --quiet probes.
async function runQuiet(args: GitArgs, cwd?: string): Promise<number> {
  try {
    return cwd
      ? (await $`git -C ${cwd} ${args}`).exitCode
      : (await $`git ${args}`).exitCode;
  } catch (e: unknown) {
    // SAFETY: ShellError only carries a numeric exitCode; anything else is a
    // non-ShellError throw, which we normalize to 1.
    return typeof (e as { exitCode?: unknown }).exitCode === "number"
      ? (e as { exitCode: number }).exitCode
      : 1;
  }
}

export const gitDiff = async (cwd?: string): Promise<string> => {
  // staged (index vs HEAD), then unstaged/untracked (working tree vs index).
  const staged = await run(["diff", "--staged"], cwd);
  const unstaged = await run(["diff", "--"], cwd);
  // `git diff --cached --quiet` has no stdout; it exits 1 when the index differs
  // from HEAD, so the "staged changes present" marker must key off the exit code,
  // not the output length (otherwise it is always false).
  const hasStaged =
    (await runQuiet(["diff", "--cached", "--quiet"], cwd)) === 1;
  return staged + unstaged + (hasStaged ? "\n(staged changes present)\n" : "");
};

export const gitAdd = async (cwd?: string): Promise<string> =>
  run(["add", "-A"], cwd);

export const gitCommit = async (
  message: string,
  cwd?: string,
): Promise<string> => run(["commit", "-m", message], cwd);

export const gitRevert = async (
  target: string,
  cwd?: string,
): Promise<string> => run(["revert", "--no-commit", target], cwd);
