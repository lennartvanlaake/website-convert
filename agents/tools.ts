import * as z from "zod";
export { wc, head, tail, readLines, ls, grepRecursive };
import { tool } from "langchain";
import { $ } from "bun";

const wc = tool(
  async ({ file, type }) => {
    return (await $`wc -${type} ${file}`).text();
  },
  {
    name: "wc",
    description:
      "Wraps the `wc` command line tool. Gives a word/line/char count",
    schema: z.object({
      file: z.string().describe("File to get wc for"),
      type: z
        .literal(["c", "m", "l", "w"])
        .describe(
          "Modifier for wc command. c for bytes, m for chars, l for lines, w for words",
        ),
    }),
  },
);

const head = tool(
  async ({ file }) => {
    return (await $`head ${file}`).text();
  },
  {
    name: "head",
    description: "Outputs first 10 lines of a file",
    schema: z.object({
      file: z.string(),
    }),
  },
);

const tail = tool(
  async ({ file }) => {
    return (await $`rtk tail ${file}`).text();
  },
  {
    name: "tail",
    description: "Outputs last 10 lines of a file",
    schema: z.object({
      file: z.string(),
    }),
  },
);

const ls = tool(
  async ({ path }) => {
    return (await $`ls ${path}`).text();
  },
  {
    name: "ls",
    description: "Lists directory contents",
    schema: z.object({
      path: z.string().describe("Directory or file to list"),
    }),
  },
);

const grepRecursive = tool(
  async ({ path, pattern }) => {
    return (await $`grep -R -n ${pattern} ${path}`).text();
  },
  {
    name: "grepRecursive",
    description: "Recursively searches for a pattern in a directory",
    schema: z.object({
      path: z.string().describe("Directory or file to search"),
      pattern: z.string().describe("Pattern to search for"),
    }),
  },
);

const readLines = tool(
  async ({ file, startLine, numberOfLines }) => {
    if (numberOfLines > 100) {
      return "ERROR: numberOfLines cannot be higher than 100";
    }
    return (
      await $`sed -n ${startLine},${startLine + numberOfLines}p ${file}`
    ).text();
  },
  {
    name: "wordcount",
    description: "Outputs last 10 lines of a file",
    schema: z.object({
      file: z.string(),
      startLine: z.number(),
      numberOfLines: z.number().describe("Number of lines to read. Max 100"),
    }),
  },
);

export const scoutTools = [wc, head, tail, readLines, ls, grepRecursive];
