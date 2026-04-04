import type { Prisma } from '@prisma/client';

import type { ChatSummary } from '@agent-workbench/shared';

type ChatWithSessionRow = Prisma.ChatGetPayload<{
  include: { session: true };
}>;

export function toChatSummary(chat: ChatWithSessionRow): ChatSummary {
  return {
    id: chat.id,
    scopeId: chat.scopeId,
    sessionId: chat.sessionId,
    title: chat.title,
    runnerId: chat.session.runnerId,
    runnerType: chat.session.runnerType,
    status: chat.session.status as ChatSummary['status'],
    lastEventId: chat.session.lastEventId,
    createdAt: chat.session.createdAt.toISOString(),
    updatedAt: chat.session.updatedAt.toISOString()
  };
}
