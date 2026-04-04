import type { Prisma } from '@prisma/client';

import type { ChatSummary } from '@agent-workbench/shared';

type ChatRow = Prisma.ChatGetPayload<object>;

export function toChatSummary(chat: ChatRow): ChatSummary {
  return {
    id: chat.id,
    scopeId: chat.scopeId,
    sessionId: chat.sessionId,
    title: chat.title,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString()
  };
}
