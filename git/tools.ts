import { tool, type StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as service from "./service";

// ponytail: structured tools so the schema is exposed to the model
// (name, description, typed params). The wrappers call into ./service, which
// shells out to git with the bun $ operator.

export const gitDiffTool = tool(
  async (): Promise<string> =>
    `Staged:\n${await service.gitDiff()}`,
  {
    name: "git_diff",
    description:
      "Show the diff between the working tree and HEAD, plus the staged changes. Use before committing to review what would be included.",
    schema: z.object({}),
  },
);

export const gitAddTool = tool(
  async (): Promise<string> => `Added: ${await service.gitAdd()}`,
  {
    name: "git_add",
    description: "Stage all changes for the next commit (git add -A). Use once you've reviewed the diff and are ready to commit.",
    schema: z.object({}),
  },
);

export const gitCommitTool = tool(
  async (params: { message: string }): Promise<string> =>
    `Committed:\n${await service.gitCommit(params.message)}`,
  {
    name: "git_commit",
    description:
      "Create a commit with the given message (git commit -m). Use after git_add; never on a non-empty index without staging first.",
    schema: z.object({
      message: z
        .string()
        .min(1)
        .describe("Commit message summarizing the change."),
    }),
  },
);

export const gitRevertTool = tool(
  async (params: { target: string }): Promise<string> =>
    `Reverted:\n${await service.gitRevert(params.target)}`,
  {
    name: "git_revert",
    description:
      "Revert the working tree to a commit or branch without creating a new commit (git revert --no-commit). Use to undo unwanted changes; pass the commit hash or branch name.",
    schema: z.object({
      target: z
        .string()
        .min(1)
        .describe("Commit hash or branch name to revert against."),
    }),
  },
);

export const gitTools = Object.fromEntries([
  ["git_diff", gitDiffTool],
  ["git_add", gitAddTool],
  ["git_commit", gitCommitTool],
  ["git_revert", gitRevertTool],
]) as Record<string, StructuredTool>;

export default gitDiffTool;
