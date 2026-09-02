import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

export const mainModel = new ChatOpenAI({
  model: "Ornith",
  temperature: 0,
  configuration: { baseURL: "http://localhost:8080/v1" },
  apiKey: "na",
});

export const miniModel = new ChatOpenAI({
  model: "Smol",
  temperature: 0,
  configuration: { baseURL: "http://localhost:8080/v1" },
  apiKey: "na",
});

export const miniEmbed = new OpenAIEmbeddings({
  model: "Jasper",
  configuration: { baseURL: "http://localhost:8080/v1" },
  dimensions: 768,
  apiKey: "na",
});
