import * as z from "zod";
import { tool } from "langchain";
import { $ } from "bun";

const wc = tool(
  async ({ file, type }) => {
    return await $`wc -${type} ${file}`;
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
    return await $`head ${file}`;
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
    return await $`rtk tail ${file}`;
  },
  {
    name: "tail",
    description: "Outputs last 10 lines of a file",
    schema: z.object({
      file: z.string(),
    }),
  },
);

const readLines = tool(
  async ({ file, startLine, numberOfLines }) => {
    if (numberOfLines > 100) {
      return "ERROR: numberOfLines cannot be higher than 100";
    }
    return await $`sed -n ${startLine},${startLine + numberOfLines} ${file}`;
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

export const scoutTools = [wc, head, tail, readLines];
