import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const localProvider = createOpenAICompatible({
  name: "local",
  baseURL: "http://localhost:8080/v1",
});

export const mainModel = localProvider("Ornith");

export const miniModel = localProvider("Smol");
