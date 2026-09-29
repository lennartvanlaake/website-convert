import z from "zod/v4";
import { $ } from "bun";
import { sandboxCommand } from "../sandbox/sandbox";
import { tool } from "ai";

export const wc = tool({
  description: "Wraps the `wc` command line tool. Gives a word/line/char count",
  inputSchema: z.object({
    file: z.string().describe("File to get wc for"),
    type: z
      .literal(["c", "m", "l", "w"])
      .describe(
        "Modifier for wc command. c for bytes, m for chars, l for lines, w for words",
      ),
  }),
  execute: async ({ file, type }) => {
    return (await $`wc -${type} ${file}`).text();
  },
});

export const ls = tool({
  description: "Lists directory contents",
  inputSchema: z.object({
    path: z.string().describe("Directory or file to list"),
  }),
  contextSchema: z.object({
    workingDir: z.string(),
  }),
  execute: async ({ path }, { context }) => {
    return sandboxCommand(context.workingDir, `ls ${path}`);
  },
});

export const grepRecursive = tool({
  description: "Recursively searches for a pattern in a directory",
  inputSchema: z.object({
    path: z.string().describe("Directory or file to search"),
    pattern: z.string().describe("Pattern to search for"),
  }),
  execute: async ({ path, pattern }) => {
    const out = (await $`grep -R -n ${pattern} ${path}`).text();
    return out.trim() ? out : "No matches found";
  },
});

export const simplifyHtml = tool({
  description:
    "Returns a vastly simplified version of the html in the body of the file. Keeps headers and text, strips everything else",
  inputSchema: z.object({
    path: z.string().describe("HTML file"),
  }),
  execute: async ({ path }) => {
    return (await $`cat ${path} | trafilatura --html`).text();
  },
});

export const searchHtml = tool({
  description:
    "Returns the content of an element or set of elements in the html body selected by a CSS query",
  inputSchema: z.object({
    path: z.string().describe("HTML file"),
    query: z
      .string()
      .describe(
        "CSS query for the element ('nav' to get the contents of nav element, '.someclass' for elements with class='someclass' )",
      ),
  }),
  execute: async ({ path, query }) => {
    return (await $`cat ${path} | pup '${query}'`).text();
  },
});

export const readLines = tool({
  description: "Reads specified lines from a file",
  inputSchema: z.object({
    file: z.string(),
    startLine: z.number(),
    numberOfLines: z.number().describe("Number of lines to read. Max 100"),
  }),
  execute: async ({ file, startLine, numberOfLines }) => {
    if (numberOfLines > 100) {
      return "ERROR: numberOfLines cannot be higher than 100";
    }
    return (
      await $`sed -n ${startLine},${startLine + numberOfLines}p ${file}`
    ).text();
  },
});
