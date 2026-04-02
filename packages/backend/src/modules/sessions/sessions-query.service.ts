import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { AgentRunner } from '@prisma/client';
import {
  MessageRole,
  MessageStatus,
  type SessionMessageDetail,
  type SessionMessageMetric,
  type SessionSummary,
  type SessionToolUse
} from '@agent-workbench/shared';

import { sanitizeJson } from '../../common/json.utils';
import { assertResourceIdsExist, type ResourceIdType } from '../../common/resource.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionMapper } from './session-mapper';
import type { SessionRow } from './session.types';

function sessionMessageAscendingOrder() {
  return [{ createdAt: 'asc' as const }, { id: 'asc' as const }];
}

function sessionMessageDescendingOrder() {
  return [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
}

function eventAscendingOrder() {
  return [{ eventId: 'asc' as const }, { id: 'asc' as const }];
}

@Injectable()
export class SessionsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionMapper: SessionMapper
  ) {}

  async list(scopeId: string): Promise<SessionSummary[]> {
    await this.assertProjectExists(scopeId);

    const sessions = await this.prisma.agentSession.findMany({
      where: { scopeId },
      orderBy: { updatedAt: 'desc' }
    });

    return sessions.map((session) => this.sessionMapper.toSessionSummary(session));
  }

  async getById(id: string) {
    const session = await this.getSessionOrThrow(id);
    return this.sessionMapper.toSessionDetail(session);
  }

  async listMessages(sessionId: string): Promise<SessionMessageDetail[]> {
    await this.getSessionOrThrow(sessionId);

    const messages = await this.prisma.sessionMessage.findMany({
      where: { sessionId },
      orderBy: sessionMessageAscendingOrder()
    });
    const toolUses = await this.prisma.messageToolUse.findMany({
      where: { sessionId },
      orderBy: eventAscendingOrder()
    });
    const metrics = await this.prisma.sessionMetric.findMany({
      where: { sessionId },
      orderBy: eventAscendingOrder()
    });
    const toolUsesByMessageId = new Map<string, SessionToolUse[]>();
    const metricsByMessageId = new Map<string, SessionMessageMetric[]>();

    for (const toolUse of toolUses) {
      const list = toolUsesByMessageId.get(toolUse.messageId) ?? [];
      list.push({
        id: toolUse.id,
        eventId: toolUse.eventId,
        callId: toolUse.callId,
        toolName: toolUse.toolName,
        args: sanitizeJson(toolUse.args),
        result: sanitizeJson(toolUse.result),
        error: sanitizeJson(toolUse.error),
        createdAt: toolUse.createdAt.toISOString()
      });
      toolUsesByMessageId.set(toolUse.messageId, list);
    }

    for (const metric of metrics) {
      if (!metric.messageId) {
        continue;
      }

      const list = metricsByMessageId.get(metric.messageId) ?? [];
      list.push(this.sessionMapper.toSessionMessageMetric(metric));
      metricsByMessageId.set(metric.messageId, list);
    }

    return messages.map((message) =>
      this.sessionMapper.toSessionMessageDetail(
        message,
        toolUsesByMessageId.get(message.id) ?? [],
        metricsByMessageId.get(message.id) ?? []
      )
    );
  }

  getSessionMessageOrder() {
    return sessionMessageAscendingOrder();
  }

  getSessionMessageDescendingOrder() {
    return sessionMessageDescendingOrder();
  }

  getEventAscendingOrder() {
    return eventAscendingOrder();
  }

  async getSessionMessages(sessionId: string) {
    return this.prisma.sessionMessage.findMany({
      where: { sessionId },
      orderBy: sessionMessageAscendingOrder()
    });
  }

  async getLatestStreamingAssistantMessage(sessionId: string) {
    return this.prisma.sessionMessage.findFirst({
      where: {
        sessionId,
        role: MessageRole.Assistant,
        status: MessageStatus.Streaming
      },
      orderBy: sessionMessageDescendingOrder()
    });
  }

  async getSessionOrThrow(id: string) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id }
    });
    if (!session) {
      throw new NotFoundException(`Session not found: ${id}`);
    }

    return session;
  }

  async getSessionOrNull(id: string) {
    return this.prisma.agentSession.findUnique({
      where: { id }
    });
  }

  async getRunnerOrThrow(id: string): Promise<AgentRunner> {
    const runner = await this.prisma.agentRunner.findUnique({
      where: { id }
    });
    if (!runner) {
      throw new NotFoundException(`AgentRunner not found: ${id}`);
    }

    return runner;
  }

  async assertProjectExists(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id }
    });
    if (!project) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    return project;
  }

  async assertResourceIdsExist(type: ResourceIdType, ids: string[]) {
    return assertResourceIdsExist(this.prisma, type, ids);
  }
}
