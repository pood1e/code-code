import { describe, expect, it } from "vitest";
import { parseProjectionState } from "./projection";

describe("chat projection", () => {
  it("parses usage snapshot from thread state", () => {
    const projection = parseProjectionState({
      chat: { id: "chat-1", phase: "running" },
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        cachedInputTokens: 2,
        reasoningOutputTokens: 3,
        requestCount: 1,
        toolCallCount: 1,
        modelId: "gpt-5",
        contextWindowTokens: 128000,
      },
    });

    expect(projection?.usage).toEqual({
      inputTokens: 12,
      outputTokens: 7,
      cachedInputTokens: 2,
      reasoningOutputTokens: 3,
      requestCount: 1,
      toolCallCount: 1,
      modelId: "gpt-5",
      contextWindowTokens: 128000,
    });
  });
});
