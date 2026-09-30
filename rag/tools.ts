import z from "zod/v4";
import { tool } from "ai";
import { searchRag } from "./search";

export const searchTool = tool({
  description:
    "Look up information about a library, topic, or concept from the RAG corpus. Use when the agent needs reference material.",
  inputSchema: z.object({
    // query: what the user asked about, rephrased for retrieval.
    query: z.string().min(1).describe("The search question/phrase."),
    // type: which source kind to pull from.
    type: z
      .enum(["examples", "docs", "summaries"])
      .describe("Kind of content to retrieve."),
    // topic: the subject to search for (e.g. "langchain", "html").
    topic: z.string().min(1).describe("The subject/topic to search for."),
  }),
  execute: async ({ query, type, topic }) => {
    const results = await searchRag(query, 5);
    if (results.length === 0) {
      return `No results found for "${topic}" matching "${query}".`;
    }
    const preview = results
      .slice(0, 3)
      .map((r) => `${r.source}:\n${r.content}`);
    return `Top ${Math.min(results.length, 3)} results for "${type} ${topic}" matching "${query}":\n\n${preview}\n... (+${results.length - preview.length} more).`;
  },
});
