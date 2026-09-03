import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchRag } from "./search";

// ponytail: structured tool so the schema is exposed to the model (name,
// description, typed params) — this is what DynamicStructuredTool / tool()
// build on top of. Zod gives us validation + free JSON-schema for the agent.

export const searchTool = tool(
  async (args: { query: string; type: string; topic: string }) => {
    const { query, type, topic } = args;
    try {
      const results = await searchRag(query, 5);
      if (results.length === 0) {
        return `No results found for "${topic}" matching "${query}".`;
      }
      const preview = results
        .slice(0, 3)
        .map((r) => `${r.source}:\n${r.content}`);
      return `Top ${Math.min(results.length, 3)} results for "${type} ${topic}" matching "${query}":\n\n${preview}\n... (+${results.length - preview.length} more).`;
    } catch (e) {
      return `Search failed: ${(e as Error).message}`;
    }
  },
  {
    name: "search_library",
    description:
      "Look up information about a library, topic, or concept from the RAG corpus. Use when the agent needs reference material.",
    schema: z.object({
      // query: what the user asked about, rephrased for retrieval.
      query: z.string().min(1).describe("The search question/phrase."),
      // type: which source kind to pull from.
      type: z
        .enum(["examples", "docs", "summaries"])
        .describe("Kind of content to retrieve."),
      // topic: the subject to search for (e.g. "langchain", "html").
      topic: z.string().min(1).describe("The subject/topic to search for."),
    }),
  },
);

export default searchTool;
