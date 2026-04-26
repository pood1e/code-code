import { describe, expect, it } from "vitest";
import { formatToolCallPayload } from "./chat-tool-call-format";

describe("tool call formatting", () => {
  it("pretty prints AG-UI JSON encoded arguments", () => {
    expect(formatToolCallPayload(`{"summary":"ls"}`)).toBe('{\n  "summary": "ls"\n}');
  });

  it("keeps non-JSON output readable", () => {
    expect(formatToolCallPayload("plain output")).toBe("plain output");
  });

  it("formats object payloads", () => {
    expect(formatToolCallPayload({ summary: "done" })).toBe('{\n  "summary": "done"\n}');
  });
});
