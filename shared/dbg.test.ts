import { test } from "bun:test";
import { MockLanguageModelV4, ToolLoopAgent } from "ai";
import { tool } from "ai";
import { grepRecursive } from "./tools";

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

test("inspect result", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [
      {
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "testTool",
            input: JSON.stringify({
              path: `${import.meta.dir}/fixtures/testdir`,
              pattern: "nonexistent-pattern",
            }),
          },
        ],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
        warnings: [],
      },
      {
        content: [{ type: "text", text: "" }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      },
    ],
  });
  const agent = new ToolLoopAgent({
    model,
    tools: { testTool: tool(grepRecursive) },
    toolsContext: { testTool: { workingDir: `${import.meta.dir}/../..` } },
  });
  const result = await agent.generate({ prompt: "" });
  console.log("STEP0:", JSON.stringify(result.steps[0], null, 2));
});
