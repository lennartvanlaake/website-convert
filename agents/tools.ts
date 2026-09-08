import * as z from "zod";
import { tool } from "langchain";
import { $ } from "bun";
import { sandboxCommand } from "../sandbox/sandbox";

export function renderScoutTools(workingDir: string) {
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
      return sandboxCommand(workingDir, `ls ${path}`);
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

  const simplyHtml = tool(
    async ({ path }) => {
      return (await $`cat ${path} | trafilatura --html`).text();
    },
    {
      name: "simplifyBodyHtml",
      description:
        "Returns a vastly simplified version of the html in the body of the file. Keeps headers and text, strips everything else",
      schema: z.object({
        path: z.string().describe("HTML file"),
      }),
    },
  );

  const searchHtml = tool(
    async ({ path, query }) => {
      return (await $`cat ${path} | pup '${query}'`).text();
    },
    {
      name: "simplifyBodyHtml",
      description:
        "Returns a vastly simplified version of the html in the body of the file. Keeps headers and text, strips everything else",
      schema: z.object({
        path: z.string().describe("HTML file"),
        query: z
          .string()
          .describe(
            "CSS query for the element ('nav' to get the contents of nav element, '.someclass' for elements with class='someclass' )",
          ),
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
      name: "readLines",
      description: "Reads specified lines from a file",
      schema: z.object({
        file: z.string(),
        startLine: z.number(),
        numberOfLines: z.number().describe("Number of lines to read. Max 100"),
      }),
    },
  );
  return [wc, readLines, ls, simplyHtml, searchHtml];
}
