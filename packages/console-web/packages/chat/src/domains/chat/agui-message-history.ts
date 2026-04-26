import { MessageSchema } from "@ag-ui/core";
import type { ChatMessage } from "./types";

export function chatMessageHistoryKey(messages: ChatMessage[]) {
  return messages
    .map((message) => JSON.stringify(MessageSchema.parse(message)))
    .join("\n");
}
