import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

export const mainModel = new ChatOpenAI({
  model: "Ornith",
  temperature: 0,
  // ponytail: the hung llama.cpp server drops mid-request; @langchain/openai
  // only applies `configuration.timeout` to the client (top-level `timeout`
  // only bounds the streaming body, which we never use). Without this a hung
  // request waits the SDK default of 10 min.
  configuration: { baseURL: "http://localhost:8080/v1", timeout: 8_000 },
  apiKey: "na",
  // ponytail: disable streaming. The subgraph reads the final message only, and
  // the non-streaming completions path is the one that returns reliably for
  // tool_call responses; the default streaming SSE path hangs on them.
  streaming: false,
});

export const miniModel = new ChatOpenAI({
  model: "Smol",
  temperature: 0,
  // ponytail: hung llama.cpp requests fail fast (10 min default otherwise).
  configuration: { baseURL: "http://localhost:8080/v1", timeout: 8_000 },
  apiKey: "na",
});

export const miniEmbed = new OpenAIEmbeddings({
  model: "Jasper",
  configuration: { baseURL: "http://localhost:8080/v1" },
  dimensions: 768,
  apiKey: "na",
});
