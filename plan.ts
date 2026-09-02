// import { ChatOpenAI } from "@langchain/openai";
// import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
// import { OpenAIEmbeddings } from "@langchain/openai";
// import { Document } from "@langchain/core/documents";
// import { tool } from "@langchain/core/tools";
// import { StateGraph, MessagesState, START, END } from "@langchain/langgraph";
// import { ToolNode } from "@langchain/langgraph/prebuilt";
// import { z } from "zod";
//
// // 1. Initialize local vector store and populate with local documents
// const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
//
// const tools = [retrieveTool];
// const toolNode = new ToolNode(tools);
//
// // 3. Bind tools to the model
// const model = new ChatOpenAI({ model: "gpt-4o-mini" }).bindTools(tools);
//
// // 4. Define graph logic
// async function callModel(state: typeof MessagesState.State) {
//   const response = await model.invoke(state.messages);
//   return { messages: [response] };
// }
//
// function shouldContinue(state: typeof MessagesState.State) {
//   const lastMessage = state.messages.at(-1);
//   if (
//     lastMessage &&
//     "tool_calls" in lastMessage &&
//     Array.isArray(lastMessage.tool_calls) &&
//     lastMessage.tool_calls.length > 0
//   ) {
//     return "tools";
//   }
//   return END;
// }
//
// // 5. Build and compile the LangGraph workflow
// const workflow = new StateGraph(MessagesState)
//   .addNode("agent", callModel)
//   .addNode("tools", toolNode)
//   .addEdge(START, "agent")
//   .addConditionalEdges("agent", shouldContinue, {
//     tools: "tools",
//     [END]: END,
//   })
//   .addEdge("tools", "agent");
//
// const graph = workflow.compile();
