import { describe, expect, it } from "bun:test";
import { generateText } from "ai";
import { mainModel } from "../models";

describe("model test", async () => {
  it("runs a prompt", async () => {
    const sumResp = await generateText({
      model: mainModel,
      prompt: "What is 1+1?",
    });
    expect(sumResp.text).toInclude("2");
  }, 0);
});
