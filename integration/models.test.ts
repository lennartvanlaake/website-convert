import { describe, expect, it } from "bun:test";
import { sdkMainModel } from "./models";
import { generateText } from "ai";

describe("model test", async () => {
  it("runs a prompt", async () => {
    const sumResp = await generateText({
      model: sdkMainModel,
      prompt: "What is 1+1?",
    });
    expect(sumResp.text).toInclude("2");
  }, 0);
});
