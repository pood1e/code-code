import { describe, expect, it } from "vitest";
import { chatMessageHistoryKey } from "./agui-message-history";
import type { ChatMessage } from "./types";

describe("AG-UI message history key", () => {
  it("changes when assistant tool calls change without content changes", () => {
    const base: ChatMessage[] = [{
      id: "assistant-1",
      role: "assistant",
      content: "checking",
    }];
    const withToolCall: ChatMessage[] = [{
      id: "assistant-1",
      role: "assistant",
      content: "checking",
      toolCalls: [{
        id: "tool-1",
        type: "function",
        function: {
          name: "shell",
          arguments: `{"cmd":"ls"}`,
        },
      }],
    }];

    expect(chatMessageHistoryKey(withToolCall)).not.toBe(chatMessageHistoryKey(base));
  });

  it("changes when tool result linkage changes", () => {
    const first: ChatMessage[] = [{
      id: "tool-message-1",
      role: "tool",
      content: `{"summary":"ok"}`,
      toolCallId: "tool-1",
    }];
    const second: ChatMessage[] = [{
      id: "tool-message-1",
      role: "tool",
      content: `{"summary":"ok"}`,
      toolCallId: "tool-2",
    }];

    expect(chatMessageHistoryKey(second)).not.toBe(chatMessageHistoryKey(first));
  });
});
