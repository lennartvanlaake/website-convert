import { ToolLoopAgent } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 20,
    text: 20,
    reasoning: undefined,
  },
};

export async function testInvokeTool(
  toolDef: any,
  input: any,
  context: any = {},
): Promise<any> {
  const model = new MockLanguageModelV4({
    doGenerate: [
      {
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "testTool",
            input: JSON.stringify(input),
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
    tools: {
      testTool: toolDef,
    },
    // @ts-ignore
    toolsContext: { testTool: context },
  });

  const result = await agent.generate({ prompt: "" });

  // @ts-ignore
  //
  const toolOutput = result.steps[0]!!.content[1]!! as any;

  //console.log(JSON.stringify(toolOutput, null, 2));

  if (toolOutput.error) {
    return `ERROR: ${toolOutput.error}`;
  } else {
    return toolOutput.output;
  }
}
