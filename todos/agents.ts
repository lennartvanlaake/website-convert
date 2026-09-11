import { mainModel } from "../models";
import { createAgent } from "langchain";
import { loggingCallbacks } from "../agents/agents";
import { createTaskTool, createSubtaskTool } from "./tools.ts";

export async function runManagerAgent(task: string) {
  // add SCRUM-middleware and RAG-middleware
  const agent = createAgent({
    model: mainModel,
    tools: [createTaskTool, createSubtaskTool],
  });

  await agent.invoke(
    {
      messages: [
        {
          role: "system",
          content:
            "You are an expect manager and delegator. You do not do work, you create tasks and subtaks with detailed but concise descriptions so your workers can execute them perfectly. Be transparent about your thought-process - explain it to me.",
        },
        {
          role: "user",
          content: `${task}`,
        },
      ],
    },
    {
      configurable: { thread_id: crypto.randomUUID() },
      ...loggingCallbacks,
    },
  );
}
